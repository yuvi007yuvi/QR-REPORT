import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportRecord } from './dataProcessor';

export const exportToExcel = (data: ReportRecord[], filename: string = 'QR_Report') => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (data: ReportRecord[], title: string = 'QR Scanned Report', filename: string = 'QR_Report') => {
    const doc = new jsPDF();

    const tableColumn = ["QR ID", "Ward", "Zone", "Assigned To", "Status", "Scanned By", "Scan Time"];
    const tableRows: string[][] = [];

    data.forEach((row) => {
        const rowData = [
            row.qrId,
            row.ward,
            row.zone,
            row.assignedTo,
            row.status,
            row.scannedBy,
            row.scanTime,
        ];
        tableRows.push(rowData);
    });

    doc.text(title, 14, 15);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        // Alternate row colors based on status? Difficult in autotable standard, but possible with didParseCell
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) { // Status column
                const status = data.cell.raw;
                if (status === 'Scanned') {
                    data.cell.styles.textColor = [0, 128, 0];
                } else if (status === 'Pending') {
                    data.cell.styles.textColor = [255, 0, 0];
                } else if (status === 'Unknown') {
                    data.cell.styles.textColor = [200, 150, 0];
                }
            }
        }
    });

    doc.save(`${filename}.pdf`);
};

import { toJpeg, toPng } from 'html-to-image';

export const exportToJPEG = async (elementId: string, filename: string = 'QR_Report') => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Store original styles
    const originalStyle = {
        height: element.style.height,
        maxHeight: element.style.maxHeight,
        overflow: element.style.overflow
    };

    // Find scrollable children and store their styles
    const scrollables = Array.from(element.querySelectorAll('.overflow-y-auto, .overflow-x-auto, .overflow-auto')) as HTMLElement[];
    const scrollableStyles = scrollables.map(el => ({
        el,
        height: el.style.height,
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow
    }));

    try {
        // Expand element and children
        element.style.height = 'auto';
        element.style.maxHeight = 'none';
        element.style.overflow = 'visible';

        scrollables.forEach(el => {
            el.style.height = 'auto';
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
        });

        // Small wait for layout
        await new Promise(resolve => setTimeout(resolve, 50));

        const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff' });

        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = dataUrl;
        link.click();

    } catch (error) {
        console.error('Error exporting to JPEG:', error);
    } finally {
        // Restore styles
        element.style.height = originalStyle.height;
        element.style.maxHeight = originalStyle.maxHeight;
        element.style.overflow = originalStyle.overflow;

        scrollableStyles.forEach(({ el, height, maxHeight, overflow }) => {
            el.style.height = height;
            el.style.maxHeight = maxHeight;
            el.style.overflow = overflow;
        });
    }
};

export const exportToPDFImage = async (elementId: string, filename: string = 'QR_Report') => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Store original styles
    const originalStyle = {
        height: element.style.height,
        maxHeight: element.style.maxHeight,
        overflow: element.style.overflow
    };

    const scrollables = Array.from(element.querySelectorAll('.overflow-y-auto, .overflow-x-auto, .overflow-auto')) as HTMLElement[];
    const scrollableStyles = scrollables.map(el => ({
        el,
        height: el.style.height,
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow
    }));

    try {
        // Expand element and children
        element.style.height = 'auto';
        element.style.maxHeight = 'none';
        element.style.overflow = 'visible';

        scrollables.forEach(el => {
            el.style.height = 'auto';
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Use PNG for better quality in PDF
        const dataUrl = await toPng(element, { backgroundColor: '#ffffff' });

        const imgWidth = element.offsetWidth;
        const imgHeight = element.offsetHeight;

        const doc = new jsPDF({
            orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [imgWidth, imgHeight]
        });

        doc.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
        doc.save(`${filename}.pdf`);

    } catch (error) {
        console.error('Error exporting to PDF:', error);
    } finally {
        // Restore styles
        element.style.height = originalStyle.height;
        element.style.maxHeight = originalStyle.maxHeight;
        element.style.overflow = originalStyle.overflow;

        scrollableStyles.forEach(({ el, height, maxHeight, overflow }) => {
            el.style.height = height;
            el.style.maxHeight = maxHeight;
            el.style.overflow = overflow;
        });
    }
};
