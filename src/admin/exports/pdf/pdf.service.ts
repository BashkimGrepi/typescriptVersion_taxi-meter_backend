import { Injectable } from "@nestjs/common";
import { buildPaymentsHtml } from "./html-templates";
import puppeteer from "puppeteer";



@Injectable()
export class PdfService {
    /*
    render the payments export snapshot to a pdf buffer using headless chromium.
    we pass only the snapshot (no BB calls)
    */
    
    async renderPaymentsPdf(snapshot: any): Promise<Buffer> {
        const html = buildPaymentsHtml(snapshot);

        //Launch chromium. you need this in many linux services
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            // Set html content and wait for fonts/layout to settle
            await page.setContent(html, { waitUntil: 'networkidle0' });

            await page.emulateMediaType('print');

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: false,
                margin: {
                    top: '16mm',
                    right: '14mm',
                    bottom: '16mm',
                    left: '14mm'
                },
            });

           const pdfBuffer = Buffer.from(pdf);
            return pdfBuffer;
        } finally {
            await browser.close();
        }

    }
}