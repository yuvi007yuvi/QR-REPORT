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

import { toJpeg } from 'html-to-image';

export const exportToJPEG = async (elementId: string, filename: string = 'QR_Report') => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
        const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = dataUrl;
        link.click();
    } catch (error) {
        console.error('Error exporting to JPEG:', error);
    }
};
