import { Actor, log } from 'apify';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

Actor.main(async () => {
    try {
        log.info('*** SB Xero OCR FILE: Actor.main started');

        const input = (await Actor.getInput()) ?? {};

        // 1) Expect { json: "<stringified payload>" }
        if (typeof input.json !== 'string' || !input.json.trim()) {
            throw new Error("Input must contain a non-empty 'json' string field.");
        }

        let spec;
        try {
            spec = JSON.parse(input.json);
        } catch (err) {
            log.error('Failed to JSON.parse input.json', { message: err?.message });
            throw new Error('Invalid JSON in input.json');
        }

        // 2) Now work with the inner object (what Make created)
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
        } = spec;

        // 3) If we don't have the file bytes, log + push a NO_FILE row
        if (!fileContentBase64) {
            log.warning('No fileContentBase64 provided – exiting (NO_FILE).');

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
                Ocr_text: '',
                Has_text_layer: false,
                File_size_bytes: 0,
                Reason: 'NO_FILE',
            });

            await Actor.setValue('OUTPUT', {
                ok: false,
                reason: 'NO_FILE',
                invoiceId,
                lineItemId,
                attachmentId,
            });
            return;
        }

        // 4) Decode the Base64 → PDF buffer
        const buffer = Buffer.from(fileContentBase64, 'base64');

        // 5) Write to temp file (handy for debugging)
        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');
        await fs.writeFile(pdfPath, buffer);
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

        // 6) Parse PDF text
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

        // 7) Push a row into dataset
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

        // 8) KV output
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
