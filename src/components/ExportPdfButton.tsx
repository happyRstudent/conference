"use client";

import { useState } from "react";
import type { RecommendationResult } from "@/lib/models/types";
import { downloadRecommendationPdf } from "@/lib/services/pdfExportService";

export function ExportPdfButton({ result }: { result: RecommendationResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setError("");
    setLoading(true);
    try {
      await downloadRecommendationPdf(result);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={loading}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
      >
        {loading ? "导出中..." : "导出 PDF"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
