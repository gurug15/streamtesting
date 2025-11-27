"use client";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { useState } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_BUCKET!;
const MDSRV_SERVER_URL = process.env.NEXT_PUBLIC_MDSRV_URL;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function useFileUpload() {
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [error, setError] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string>("");

  const handleUpload = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Create unique filename to avoid conflicts
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `public/${fileName}`;

      // Upload file
      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        console.error("Upload error:", uploadError);
        setLoading(false);
        return;
      } else {
        setFileUploaded(true);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      setPublicUrl(urlData.publicUrl);
      setUploadProgress(100);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error:", err);
      setLoading(false);
    }
  };

  const uploadToMDSrv = async (
    name: string = fileName.substring(0, fileName.lastIndexOf(".")),
    description: string = "Uploaded trajectory",
    source: string = "Supabase"
  ) => {
    if (!MDSRV_SERVER_URL || !publicUrl) {
      setError("Missing MDsrv URL or file URL");
      return;
    }

    try {
      const endpoint = `${MDSRV_SERVER_URL}/upload/trajectory/${encodeURIComponent(
        publicUrl
      )}/${encodeURIComponent(name)}/${encodeURIComponent(
        description
      )}/${encodeURIComponent(source)}`;
      const response = await axios.get(endpoint);

      console.log("uploaded data to md:", response.data);
      return response.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "MDsrv upload failed";
      setError(errorMessage);
      console.error("MDsrv error:", err);
    }
  };

  return {
    publicUrl,
    handleUpload,
    loading,
    error,
    fileUploaded,
    uploadProgress,
    uploadToMDSrv,
  };
}
