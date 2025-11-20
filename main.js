import { Actor, log } from 'apify';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

Actor.main(async () => {
    try {
        log.info('*** SB Xero OCR FILE: Actor.main started');

        const input = (await Actor.getInput()) ?? {};

        // Helper: normalise possibly-null values to strings
        const toStr = (v) => (v === null || v === undefined ? '' : String(v));

        const fileName = toStr(input.fileName || 'file.pdf');
        const fileContentBase64 = input.fileContentBase64 || '';

        const invoiceId = toStr(input.invoiceId);
        const lineItemId = toStr(input.lineItemId);
        const attachmentId = toStr(input.attachmentId);
        const masterAttachmentKey = toStr(input.masterAttachmentKey);
        const pathLower = toStr(input.pathLower);
        const likelyTrackingHorse = toStr(input.likelyTrackingHorse);
        const xeroType = toStr(input.xeroType);
        const xeroYear = toStr(input.xeroYear);
        const targetType = toStr(input.targetType);

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

        const buffer = Buffer.from(fileContentBase64, 'base64');

        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');
        await fs.writeFile(pdfPath, buffer);
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

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
