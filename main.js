import { Actor, log } from 'apify';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

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
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

        let text = '';
        let hasTextLayer = false;

        try {
            const result = await pdfParse(buffer);
            // Normalise to LF newlines, always a string
            text = (result.text || '').replace(/\r\n/g, '\n');
            hasTextLayer = !!text.trim();

            log.info('pdf-parse completed', {
                textLength: text.length,
                hasTextLayer,
            });

            if (!hasTextLayer) {
                log.warning('No text layer detected – likely image-only scanned PDF');
            }
        } catch (err) {
            log.error('pdf-parse failed', { message: err?.message });
        }

        // One row per file – all fields inline, including Ocr_text + Has_text_layer
        await Actor.pushData({
            Invoice_ID: invoiceId,
            Line_item_ID: lineItemId,
            Attachment_ID: attachmentId,
            Master_attachment_key: masterAttachmentKey,
            File_name: fileName,
            Path_lower: pathLower,
            Likely_tracking_horse: likelyTrackingHorse,
            Xero_type: xeroType ?? '',
            Xero_year: xeroYear ?? '',
            Target_type: targetType,
            Ocr_text: text,
            Has_text_layer: hasTextLayer,
            File_size_bytes: buffer.length,
        });

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
