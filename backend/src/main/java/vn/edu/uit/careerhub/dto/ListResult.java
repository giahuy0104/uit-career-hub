package vn.edu.uit.careerhub.dto;

public record ListResult<T>(java.util.List<T> items, long total) {}
