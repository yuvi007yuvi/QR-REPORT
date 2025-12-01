import React, { useCallback } from 'react';
import { FileSpreadsheet, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface FileUploadProps {
    label: string;
    file: File | null;
    onFileSelect: (file: File) => void;
    accept?: string;
    required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    label,
    file,
    onFileSelect,
    accept = ".xlsx, .csv",
    required = false,
}) => {
    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) onFileSelect(droppedFile);
        },
        [onFileSelect]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={clsx(
                    "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                    file
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
                )}
            >
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleChange}
                    accept={accept}
                />
                <div className="flex flex-col items-center justify-center text-center">
                    {file ? (
                        <>
                            <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                            <p className="text-sm font-medium text-green-700">{file.name}</p>
                            <p className="text-xs text-green-500">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                        </>
                    ) : (
                        <>
                            <FileSpreadsheet className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">
                                Drag & drop or click to upload
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Supports .xlsx, .csv
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
