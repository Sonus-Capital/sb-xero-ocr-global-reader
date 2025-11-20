import { Actor, log } from 'apify';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

Actor.main(async () => {
    try {
        log.info('*** SB Xero OCR FILE: Actor.main started');

        const input = (await Actor.getInput()) ?? {};

        if (!input.specification || typeof input.specification !== 'object') {
            throw new Error("Input must contain a 'specification' object.");
        }

        // Everything comes from input.specification
        const spec = input.specification;

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
            targetType = ''
        } = spec;

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

        // Decode Base64 → PDF buffer
        const buffer = Buffer.from(fileContentBase64, 'base64');

        // Temp directory for PDF write
        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');

        await fs.writeFile(pdfPath, buffer);
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

        // Attempt OCR extraction
        let text = '';
        let hasTextLayer = false;

        try {
            const result = await pdfParse(buffer);
            text = result.text || '';
            hasTextLayer = !!text.trim();
            log.info('PDF parsed', { textLength: text.length, hasTextLayer });
        } catch (err) {
            log.error('pdf-parse failed', { message: err?.message });
        }

        // Push a row to dataset
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
            Ocr_text: text,
            Has_text_layer: hasTextLayer,
            File_size_bytes: buffer.length,
        });

        // KV output
        await Actor.setValue('OUTPUT', {
            ok: true,
            invoiceId,
            lineItemId,
            attachmentId,
            hasTextLayer,
            textLength: text.length,
        });

        log.info('*** SB Xero OCR FILE: Actor.main finished');

    } catch (err) {
        log.error('SB Xero OCR FILE – fatal error', {
            message: err?.message,
            stack: err?.stack,
        });
        throw err;
    }
});
