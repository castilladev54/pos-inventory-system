import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;

// Helper que inyecta la condicional de seguridad para la conversión a Decimal128
const buildCond = (fieldName) => ({
  $cond: {
    if: { 
      $and: [
        { $ne: [`$${fieldName}`, null] },
        // Valida que el tipo actual sea un número de MongoDB (double, int o long)
        { $in: [{ $type: `$${fieldName}` }, ["double", "int", "long"]] }
      ]
    },
    then: { $toDecimal: `$${fieldName}` },
    else: `$${fieldName}`
  }
});

async function run() {
  if (!mongoUri) {
    console.error("MONGO_URI no está definido en .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Conectado a MongoDB para migración...");

  const db = mongoose.connection.db;

  // Lista de colecciones y campos identificados con tipos de coma flotante
  const collectionsToMigrate = [
    { name: 'sales', fields: ['total_amount', 'exchange_rate'] },
    { name: 'saledetails', fields: ['quantity', 'unit_price'] },
    { name: 'purchases', fields: ['total_cost', 'exchange_rate', 'paid_amount'] },
    { name: 'purchasedetails', fields: ['quantity', 'unit_cost'] },
    { name: 'products', fields: ['price', 'max_debt_limit'] },
    { name: 'exchangerates', fields: ['rate'] },
    { name: 'supplierpayments', fields: ['amount'] },
    { name: 'branchinventories', fields: ['stock', 'min_stock'] }
  ];

  for (const coll of collectionsToMigrate) {
    const setStage = {};
    for (const field of coll.fields) {
      setStage[field] = buildCond(field);
    }
    
    console.log(`Migrando colección: ${coll.name}...`);
    try {
      // Aplicar pipeline de agregación en la actualización masiva
      const result = await db.collection(coll.name).updateMany(
        {}, 
        [{ $set: setStage }]
      );
      console.log(`- Éxito. Documentos modificados: ${result.modifiedCount}`);
    } catch(err) {
      console.error(`- Error migrando ${coll.name}: ${err.message}`);
    }
  }

  console.log("Migración completada de forma segura.");
  await mongoose.disconnect();
}

run().catch(console.error);
