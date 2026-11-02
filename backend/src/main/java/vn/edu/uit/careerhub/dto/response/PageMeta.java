package vn.edu.uit.careerhub.dto.response;

public record PageMeta(int page, int pageSize, long totalItems, long totalPages) {
    public static PageMeta of(int page, int pageSize, long totalItems) {
        return new PageMeta(page, pageSize, totalItems, (long) Math.ceil((double) totalItems / pageSize));
    }
}
