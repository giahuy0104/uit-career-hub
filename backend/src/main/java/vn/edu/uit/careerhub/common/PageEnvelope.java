package vn.edu.uit.careerhub.common;

import java.util.List;

public record PageEnvelope<T>(List<T> data, PageMeta meta) {}
