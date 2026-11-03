package vn.edu.uit.careerhub.dto;

public record ReportFile(byte[] bytes,String contentType,String fileName,int rowCount) {}
