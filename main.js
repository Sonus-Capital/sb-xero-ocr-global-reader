import { Actor, log } from 'apify';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// Make OCR text safe AND stop Make from elevating it
const sanitizeOcrText = (text) => {
    if (!text) return '';
    return text.replace(/\r?\n/g, '\\n');
};

Actor.main(async () => {
    try {
        log.info('*** SB Xero OCR FILE: Actor.main started');

        const input = (await Actor.getInput()) ?? {};
        const {
            fileName = 'file.pdf',
            fileContentBase64,
            invoiceId = '',
            lineItemId = '',
            attachmentId = '',
            masterAttachmentKey = '',
            pathLower = '',
            likelyTrackingHorse = '',
            xeroType = '',
            xeroYear = '',
            targetType = '',
        } = input;

        if (!fileContentBase64) {
            log.warning('No fileContentBase64 provided – exiting.');
            await Actor.setValue('OUTPUT', {
                ok: false,
                reason: 'NO_FILE',
                invoiceId,
                lineItemId,
            });
            return;
        }

        const buffer = Buffer.from(fileContentBase64, 'base64');
        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');

        await fs.writeFile(pdfPath, buffer);

        let rawText = '';
        let hasTextLayer = false;

        try {
            const result = await pdfParse(buffer);
            rawText = result.text || '';
            hasTextLayer = !!rawText.trim();
        } catch {}

        const ocrText = sanitizeOcrText(rawText);

        // Push normalized camelCase field so Make won't elevate it
        await Actor.pushData({
            Invoice_ID: invoiceId,
            Line_item_ID: lineItemId,
            Attachment_ID: attachmentId,
            Master_attachment_key: masterAttachmentKey,
            File_name: fileName,
            Path_lower: pathLower,
            Likely_tracking_horse: likelyTrackingHorse,
            Xero_type: xeroType,
            Xero_year: xeroYear,
            Target_type: targetType,

            // ⬇️ FIX: normalized so Make keeps it inline
            ocrText: ocrText,
        });

        await Actor.setValue('OUTPUT', {
            ok: true,
            invoiceId,
            lineItemId,
            attachmentId,
            hasTextLayer,
            textLength: rawText.length,
        });

        log.info('*** SB Xero OCR FILE: Actor.main finished');

    } catch (err) {
        log.error('FATAL ERROR', { message: err?.message });
        throw err;
    }
});
