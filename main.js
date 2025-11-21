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

        // Decode and stash temp file (mainly for debugging if needed)
        const buffer = Buffer.from(fileContentBase64, 'base64');
        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');
        await fs.writeFile(pdfPath, buffer);
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

        // ---- OCR / text layer detection ----
        let fullText = '';
        let hasTextLayer = false;

        try {
            const result = await pdfParse(buffer);
            fullText = (result.text || '').trim();
            hasTextLayer = fullText.length > 0;
            log.info('PDF parsed', {
                textLength: fullText.length,
                hasTextLayer,
            });
        } catch (err) {
            log.error('pdf-parse failed', { message: err?.message });
        }

        // Short, single-line preview for CSV safety (first 250 chars, newlines → space)
        const previewText = fullText
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 250);

        // Optional: lightly sanitise full text so it serialises cleanly
        // (keeps newlines but strips weird control chars)
        const safeFullText = fullText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // ---- Push one flat row per file ----
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

            // OCR fields
            Ocr_text: safeFullText,     // full text (may be multi-line; for archive/search)
            Ocr_preview: previewText,   // short, single line – use this in CSV
            Has_text_layer: hasTextLayer,
            File_size_bytes: buffer.length,
        });

        await Actor.setValue('OUTPUT', {
            ok: true,
            invoiceId,
            lineItemId,
            attachmentId,
            hasTextLayer,
            textLength: fullText.length,
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
