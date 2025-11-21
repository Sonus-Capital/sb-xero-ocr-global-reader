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

        // If there's no file at all, just record the failure in KEY-VALUE store
        // and do NOT push a dataset row.
        if (!fileContentBase64) {
            log.warning('No fileContentBase64 provided – exiting without dataset row.', {
                invoiceId,
                lineItemId,
            });

            await Actor.setValue('OUTPUT', {
                ok: false,
                reason: 'NO_FILE',
                invoiceId,
                lineItemId,
            });

            return;
        }

        const buffer = Buffer.from(fileContentBase64, 'base64');

        // (Temp file only kept so pdf-parse has something sane if needed later.)
        const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'file-'));
        const pdfPath = path.join(tmpDir, fileName || 'file.pdf');
        await fs.writeFile(pdfPath, buffer);
        log.info('PDF written to temp file', { pdfPath, size: buffer.length });

        let rawText = '';

        try {
            const result = await pdfParse(buffer);
            rawText = result.text || '';
            log.info('PDF parsed', { rawLength: rawText.length });
        } catch (err) {
            log.error('pdf-parse failed', { message: err?.message });
        }

        // 🔧 NORMALISE TEXT FOR CSV / MAKE
        // - remove control chars
        // - turn all newlines/tabs into spaces
        // - collapse multiple spaces to one
        let cleanedText = (rawText || '')
            // strip control characters (including the \u0000, \u0001 etc you were seeing)
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
            // normalise newlines/tabs to spaces
            .replace(/[\r\n\t]+/g, ' ')
            // collapse all whitespace runs to a single space
            .replace(/\s+/g, ' ')
            .trim();

        // If it's *really* long you can optionally truncate it here, e.g.:
        // const MAX_LEN = 20000;
        // if (cleanedText.length > MAX_LEN) {
        //     cleanedText = cleanedText.slice(0, MAX_LEN);
        // }

        // Final dataset row – same field names as before, but Ocr_text is now flat.
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
            Ocr_text: cleanedText,
            // 🚫 No Has_text_layer / File_size_bytes any more – keeps Make CSV schema simple.
        });

        await Actor.setValue('OUTPUT', {
            ok: true,
            invoiceId,
            lineItemId,
            attachmentId,
            textLength: cleanedText.length,
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
