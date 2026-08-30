import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../models/Product.js";
import { BranchInventory } from "../models/BranchInventory.js";
import { Inventory } from "../models/Inventory.js";
import { StockMovement, StockMovementType } from "../models/StockMovement.js";
import { Branch } from "../models/Branch.js";

dotenv.config();

const migrateInventory = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Conectado a MongoDB para migración de inventario...");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Migrar desde BranchInventory a Inventory
      console.log("Buscando registros en BranchInventory...");
      const branchInventories = await BranchInventory.find({}).session(session);
      
      console.log(`Se encontraron ${branchInventories.length} registros en BranchInventory.`);

      for (const bi of branchInventories) {
        // Crear Inventory
        const inventory = new Inventory({
          product_id: bi.product_id,
          branch_id: bi.branch_id,
          owner_id: bi.owner_id,
          quantity: bi.stock,
          min_stock_alert: bi.min_stock || mongoose.Types.Decimal128.fromString('0')
        });
        await inventory.save({ session });

        // Crear StockMovement inicial
        const initialMovement = new StockMovement({
          inventory_id: inventory._id,
          product_id: bi.product_id,
          branch_id: bi.branch_id,
          owner_id: bi.owner_id,
          type: StockMovementType.MANUAL_ADJUSTMENT,
          quantity_change: bi.stock,
          previous_quantity: mongoose.Types.Decimal128.fromString('0'),
          new_quantity: bi.stock,
          created_by: bi.owner_id, // Asumimos el owner como creador inicial
          reason: "Migración inicial desde BranchInventory"
        });
        await initialMovement.save({ session });
      }

      // 2. Comprobar si hay productos que aún tengan un campo "stock" residual a nivel documento
      // (Por si el modelo anterior lo usaba antes de BranchInventory)
      console.log("Verificando si existen productos con campo stock residual...");
      const db = mongoose.connection.db;
      if (db) {
        const productsWithStock = await db.collection('products').find({ stock: { $exists: true } }).toArray();
        console.log(`Se encontraron ${productsWithStock.length} productos con stock residual.`);
        
        if (productsWithStock.length > 0) {
          // Si encontramos, necesitamos una sucursal por defecto a donde asignar
          const branches = await Branch.find({}).session(session);
          
          for (const rawProduct of productsWithStock) {
            // Buscamos la primera sucursal del dueño
            const branch = branches.find(b => b.owner_id.toString() === rawProduct.user.toString());
            
            if (branch && rawProduct.stock) {
              const stockVal = mongoose.Types.Decimal128.fromString(rawProduct.stock.toString());
              
              // Verificamos si ya existe en Inventory (quizás ya se migró vía BranchInventory)
              const existingInv = await Inventory.findOne({ 
                product_id: rawProduct._id, 
                branch_id: branch._id 
              }).session(session);

              if (!existingInv) {
                const inventory = new Inventory({
                  product_id: rawProduct._id,
                  branch_id: branch._id,
                  owner_id: rawProduct.user,
                  quantity: stockVal,
                  min_stock_alert: mongoose.Types.Decimal128.fromString('0')
                });
                await inventory.save({ session });

                const initialMovement = new StockMovement({
                  inventory_id: inventory._id,
                  product_id: rawProduct._id,
                  branch_id: branch._id,
                  owner_id: rawProduct.user,
                  type: StockMovementType.MANUAL_ADJUSTMENT,
                  quantity_change: stockVal,
                  previous_quantity: mongoose.Types.Decimal128.fromString('0'),
                  new_quantity: stockVal,
                  created_by: rawProduct.user,
                  reason: "Migración inicial desde Product.stock"
                });
                await initialMovement.save({ session });
              }
            }
            
            // Eliminar el campo stock del documento de MongoDB
            await db.collection('products').updateOne(
              { _id: rawProduct._id },
              { $unset: { stock: "" } },
              { session }
            );
          }
        }
      }

      await session.commitTransaction();
      console.log("✅ Migración completada con éxito.");

      // Opcional: Eliminar la colección vieja (Se puede hacer manualmente después para estar seguros)
      // await db.collection('branchinventories').drop();
      console.log("Nota: La colección branchinventories no ha sido eliminada por seguridad. Puedes borrarla manualmente.");

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    process.exit(0);

  } catch (error) {
    console.error("Error ejecutando la migración:", error);
    process.exit(1);
  }
};

migrateInventory();
