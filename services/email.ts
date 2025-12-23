import emailjs from '@emailjs/browser';
import { LabelData } from '../types';

const STORAGE_KEYS = {
    SERVICE_ID: 'emailjs_service_id',
    TEMPLATE_ID: 'emailjs_template_id',
    PUBLIC_KEY: 'emailjs_public_key'
};

export const EmailService = {
    // Configuration
    getConfig: () => ({
        serviceId: localStorage.getItem(STORAGE_KEYS.SERVICE_ID) || '',
        templateId: localStorage.getItem(STORAGE_KEYS.TEMPLATE_ID) || '',
        publicKey: localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY) || ''
    }),

    setConfig: (serviceId: string, templateId: string, publicKey: string) => {
        localStorage.setItem(STORAGE_KEYS.SERVICE_ID, serviceId);
        localStorage.setItem(STORAGE_KEYS.TEMPLATE_ID, templateId);
        localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey);
        // Initialize immediately if key provided
        if (publicKey) emailjs.init(publicKey);
    },

    isConfigured: () => {
        const c = EmailService.getConfig();
        return !!(c.serviceId && c.templateId && c.publicKey);
    },

    // Sending
    sendReport: async (reportData: LabelData[], userEmail: string = '') => {
        const config = EmailService.getConfig();
        if (!config.serviceId || !config.templateId || !config.publicKey) {
            throw new Error("EmailJS not configured");
        }

        // Prepare Data for Template
        // We typically send a summary in the body, OR a link (if we uploaded the file elsewhere).
        // EmailJS free plan doesn't support attachments directly easily without some hacks or Base64 (limited size).
        // For a text report, we can format a table.

        const dateStr = new Date().toLocaleDateString('uk-UA');
        const count = reportData.length;
        const totalWeight = reportData.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(3);

        // Simple HTML Table for the body
        // Note: The template in EmailJS dashboard must have {{message}} or specific fields.
        // We'll assume a specific 'message' field or 'html_body'.

        const summary = `Звіт за ${dateStr}\nКількість: ${count}\nВага: ${totalWeight} кг`;

        // Construct a simple CSV-like string for the body if attachment isn't possible
        // Or better, just the summary and "Please see attached" (but we can't attach easily in basic js without base64 plugin)
        // Let's try to send main info in the email body.

        const tableRows = reportData.map(item =>
            `${new Date(item.date).toLocaleTimeString('uk-UA')} | ${item.product?.name} | ${item.weight}kg | ${item.serialNumber}`
        ).join('\n');

        const templateParams = {
            to_email: userEmail,
            date: dateStr,
            full_date: new Date().toLocaleString('uk-UA'),
            total_count: count,
            total_weight: totalWeight,
            report_summary: summary,
            report_details: tableRows, // Ensure template has {{report_details}}
            message: `${summary}\n\nДеталі:\n${tableRows}`
        };

        try {
            const response = await emailjs.send(
                config.serviceId,
                config.templateId,
                templateParams,
                config.publicKey
            );
            return response;
        } catch (error) {
            console.error('EmailJS Send Failed:', error);
            throw error;
        }
    }
};
