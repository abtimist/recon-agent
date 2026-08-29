"use client";

import { useCallback, useState } from "react";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

interface FileUploaderProps {
  label: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export function FileUploader({ label, onFileSelect, selectedFile }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Only accept CSV or Excel
      if (
        file.type === "text/csv" || 
        file.name.endsWith(".csv") ||
        file.name.endsWith(".tsv") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")
      ) {
        onFileSelect(file);
      } else {
        alert("Please upload a CSV or Excel file.");
      }
    }
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center justify-between p-4 bg-muted border border-accent/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 text-accent rounded-md">
              <FileIcon size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {selectedFile.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <button
            onClick={() => onFileSelect(null)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragOver 
            ? "border-accent bg-accent/5" 
            : "border-border bg-muted hover:bg-muted/80 hover:border-border"
        }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className={`w-8 h-8 mb-3 ${isDragOver ? "text-accent" : "text-muted-foreground"}`} />
          <p className="mb-1 text-sm text-muted-foreground">
            <span className="font-semibold text-accent">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">CSV, TSV, or XLSX</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".csv,.tsv,.xlsx,.xls,text/csv" 
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
