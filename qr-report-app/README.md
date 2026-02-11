# QR Report App - User Charge Collection Report

A comprehensive web application for analyzing and visualizing User Charge Collection data for Mathura Vrindavan Nagar Nigam.

## 🚀 Quick Start

### Prerequisites

Before running the application, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

### Installation & Running

1. **Open Terminal/Command Prompt**
   - Navigate to the project directory:
   ```bash
   cd "d:\DEVELOPMENT REPORTS\QR-REPORT\qr-report-app"
   ```

2. **Install Dependencies** (First time only)
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   - The app will automatically open in your default browser
   - If not, manually open: `http://localhost:5173`

### Alternative: Double-Click Batch File

For easier access, use the provided batch file:

1. Double-click `START_APP.bat` in the project folder
2. Wait for the browser to open automatically
3. Start using the application!

## 📊 Features

### Data Analysis
- **Ward-wise Collection Reports** - Detailed breakdown by ward and zone
- **Property Type Analysis** - Collection data by property categories
- **Monthly Trends** - Month-over-month comparison with percentage changes
- **Collection Days Tracking** - Unique collection days per month

### Visualizations
- **Interactive Charts** - Bar charts and pie charts for data visualization
- **Color-coded Tables** - Excel-like styling with gradients
- **Progress Indicators** - Visual arrows showing increases/decreases

### Export Options
- **PDF Export** - High-quality PDF with full styling and logos
- **Excel Export** - Detailed spreadsheet with all data
- **Multi-page Support** - Automatic page splitting for large datasets

### Professional Design
- **Official Headers** - Nagar Nigam and NatureGreen logos
- **Compact Layout** - Optimized for viewing and printing
- **Responsive Design** - Works on different screen sizes

## 📁 Project Structure

```
qr-report-app/
├── src/
│   ├── components/
│   │   └── UCCReport.tsx          # Main report component
│   ├── data/
│   │   └── supervisorData.json    # Sample data
│   ├── assets/
│   │   ├── nagar-nigam-logo.png   # Municipal logo
│   │   └── NatureGreen_Logo.png   # Company logo
│   └── App.tsx                     # Main app file
├── public/                         # Public assets
├── package.json                    # Dependencies
└── README.md                       # This file
```

## 🔧 Usage

### Uploading Data

1. Click the **"Upload CSV"** button
2. Select your UCC collection CSV file
3. The data will be automatically processed and displayed

### Viewing Reports

- **Table View**: Detailed ward-wise breakdown with all data
- **Charts View**: Visual representations with bar and pie charts

### Filtering Data

- **Metric Mode**: Toggle between Amount (₹) and Count (records)
- **Date Range**: Filter by specific date ranges
- **Zone/Ward**: Filter by specific zones or wards

### Exporting

- **PDF**: Click "Export PDF" for a styled PDF report
- **Excel**: Click "Export Excel" for a detailed spreadsheet

## 📋 CSV Data Format

Your CSV file should have the following columns:

- `S.No.`
- `Transaction ID`
- `Date` (DD/MM/YYYY format)
- `Ward Name` (Ward number)
- `Zone Name` (Zone number)
- `Area` (Ward name with number)
- `Property Type Name`
- `Amount Collected`
- Other optional columns...

## 🎨 Key Features Explained

### Collection Days Count
- Shows **unique days** when collections happened
- Different from total number of collection records
- Helps track operational efficiency

### Month-over-Month Comparison
- Green ↑ arrows indicate increases
- Red ↓ arrows indicate decreases
- Percentage change calculated automatically

### Grand Total Row
- Aggregates all ward data
- Shows overall collection performance
- Highlighted in yellow/orange gradient

## 🛠️ Troubleshooting

### App won't start?
```bash
# Clear node modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Port already in use?
- Close other applications using port 5173
- Or modify `vite.config.ts` to use a different port

### CSV upload not working?
- Ensure CSV has all required columns
- Check date format is DD/MM/YYYY
- Verify file encoding is UTF-8

## 📦 Dependencies

Main libraries used:

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Recharts** - Charts and visualizations
- **Papa Parse** - CSV parsing
- **jsPDF** - PDF generation
- **html-to-image** - Screenshot capture
- **XLSX** - Excel export
- **Lucide React** - Icons
- **Tailwind CSS** - Styling

## 🔄 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

## 📝 Notes

- The app runs entirely in the browser (client-side)
- No data is sent to external servers
- All processing happens locally
- CSV data is stored in browser memory only

## 🆘 Support

For issues or questions:
1. Check the console for error messages (F12 in browser)
2. Verify all dependencies are installed
3. Ensure Node.js version is compatible
4. Check CSV file format matches requirements

## 📄 License

This project is for use by Mathura Vrindavan Nagar Nigam.

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Developed for**: Mathura Vrindavan Nagar Nigam
