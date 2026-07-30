import { getAIAdviceStreamService } from '../services/ai.service.js';

export const getAIAdvice = async (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ success: false, message: 'La pregunta es requerida' });
        }

        // Configurar cabeceras de Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // CRÍTICO: flushHeaders() activa res.headersSent = true ANTES del primer await.
        // Sin esto, si el SLA timeout dispara durante getAIAdviceStreamService(),
        // headersSent sigue siendo false y el middleware envía un 504 — conflicto de headers.
        res.flushHeaders();

        // Obtener el stream desde el servicio AI
        const responseStream = await getAIAdviceStreamService(req.userId, question);

        // Iterar sobre los fragmentos generados y enviarlos al cliente
        for await (const chunk of responseStream) {
            if (chunk.text) {
                 res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
        }
        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (error) {
        console.error("Error AI Advice:", error);
        // Si las cabeceras no se han enviado, enviar error normal
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        } else {
            // Si ya estamos en streaming, enviar mensaje de error en formato SSE
            res.write(`data: ${JSON.stringify({ error: 'Hubo un error al generar la respuesta por parte de la IA.' })}\n\n`);
            res.end();
        }
    }
};
