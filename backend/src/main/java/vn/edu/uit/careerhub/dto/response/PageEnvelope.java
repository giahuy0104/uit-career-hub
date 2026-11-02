package vn.edu.uit.careerhub.dto.response;

import java.util.List;

public record PageEnvelope<T>(List<T> data, PageMeta meta) {}
