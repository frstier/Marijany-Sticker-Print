import { LabelTemplate, LabelElement, LabelSizeConfig } from '../types';
import { LABEL_SIZES } from '../constants';
import { imageToZplGrf } from './imageToZpl';

// Mapping from Constant ID (StandardInterface) to Template ID (LabelDesigner/LocalStorage)
const ID_MAPPING: Record<string, string> = {
    '100x100': 'tpl_bale_standard',
    '58x30': 'tpl_bale_compact',
    '80x60': 'tpl_qr_label', // Best guess mapping
    '100x50': 'tpl_minimal'  // Best guess mapping
};

/**
 * Converts a structured LabelTemplate object into a ZPL string with placeholders.
 * Placeholders like {weight} are preserved.
 */
export async function convertTemplateToZPL(template: LabelTemplate): Promise<string> {
    let zpl = `^XA\n^PW${template.widthDots}\n^LL${template.heightDots}\n^CI28\n\n`;

    for (const el of template.elements) {
        const rotation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';

        switch (el.type) {
            case 'text':
                zpl += `^FO${el.x},${el.y}^A0${rotation},${el.fontSize},${el.fontSize}^FH^FD${el.content}^FS\n`;
                break;
            case 'variable':
                zpl += `^FO${el.x},${el.y}^A0${rotation},${el.fontSize},${el.fontSize}^FH^FD${el.variableName}^FS\n`;
                break;
            case 'barcode':
                // Barcode width logic could be improved, ZPL width is module width usually.
                // Assuming standard ratio.
                zpl += `^FO${el.x},${el.y}^BY2\n^BCN,${el.barcodeHeight || 80},Y,N,N\n^FH^FD${el.content}^FS\n`;
                break;
            case 'qrcode':
                // Q-Code size roughly
                zpl += `^FO${el.x},${el.y}^BQN,2,${Math.round((el.width || 100) / 10)}\n^FDQA,${el.content}^FS\n`;
                break;
            case 'line':
                zpl += `^FO${el.x},${el.y}^GB${el.width},${el.height || 2},${el.height || 2}^FS\n`;
                break;
            case 'box':
                zpl += `^FO${el.x},${el.y}^GB${el.width},${el.height},2^FS\n`;
                break;
            case 'image':
                // Convert image to ZPL GRF format
                if (el.imageSrc) {
                    try {
                        const imageGrf = await imageToZplGrf(el.imageSrc, el.width, el.height);
                        zpl += `^FO${el.x},${el.y}${imageGrf}\n`;
                    } catch (err) {
                        console.error('Image conversion failed:', err);
                        // Fallback: draw box with "IMG" text
                        zpl += `^FO${el.x},${el.y}^GB${el.width},${el.height},2^FS\n`;
                        zpl += `^FO${el.x + 10},${el.y + Math.round((el.height || 100) / 2) - 10}^A0N,20,20^FDIMG^FS\n`;
                    }
                }
                break;
        }
    }

    zpl += `^PQ1\n^XZ`;
    return zpl;
}

/**
 * Retrieves the effective ZPL template for a given label size ID and optional User Role.
 * Priority:
 * 1. Role-specific assignment in localStorage
 * 2. General overrides in localStorage (matching default ID)
 * 3. Hardcoded default constant
 */
export async function getEffectiveTemplate(sizeId: string, role?: string): Promise<string> {
    try {
        const savedTemplatesJSON = localStorage.getItem('label_templates');
        const savedTemplates: LabelTemplate[] = savedTemplatesJSON ? JSON.parse(savedTemplatesJSON) : [];

        // 1. Check Role Assignment
        let targetId = '';
        if (role) {
            const roleConfigKey = `template_config_${role}_${sizeId}`;
            const assignedId = localStorage.getItem(roleConfigKey);
            if (assignedId) {
                targetId = assignedId;
                const found = savedTemplates.find(t => t.id === targetId);
                // Also check predefined if not in saved (though unlikely for custom assignments)
                if (found) {
                    console.log(`Using ROLE-assigned template for ${role}/${sizeId} (ID: ${targetId})`);
                    return await convertTemplateToZPL(found);
                }
            }
        }

        // 2. Check General Override (ID Mapping)
        if (!targetId) {
            targetId = ID_MAPPING[sizeId] || sizeId;
        }

        const found = savedTemplates.find(t => t.id === targetId);
        if (found) {
            console.log(`Using custom template for ${sizeId} (ID: ${targetId})`);
            return await convertTemplateToZPL(found);
        }
    } catch (e) {
        console.warn('Error loading custom templates:', e);
    }

    // Fallback to default
    const config = LABEL_SIZES.find(s => s.id === sizeId);
    if (!config) {
        console.warn(`Label size size config not found for ${sizeId}, using default 100x100`);
        return LABEL_SIZES[0].template;
    }

    return config.template;
}

/**
 * Assigns a specific template ID to a User Role and Label Size.
 */
export function assignTemplateToRole(role: string, sizeId: string, templateId: string) {
    const key = `template_config_${role}_${sizeId}`;
    localStorage.setItem(key, templateId);
    console.log(`Assigned template ${templateId} to role ${role} for size ${sizeId}`);
}

/**
 * Removes assignment for a role
 */
export function unassignTemplateFromRole(role: string, sizeId: string) {
    localStorage.removeItem(`template_config_${role}_${sizeId}`);
}

/**
 * Gets the assigned template ID for a role (if any)
 */
export function getAssignedTemplateId(role: string, sizeId: string): string | null {
    return localStorage.getItem(`template_config_${role}_${sizeId}`);
}

