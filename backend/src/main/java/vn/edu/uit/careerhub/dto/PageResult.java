package vn.edu.uit.careerhub.dto;

import java.util.List;
import java.util.Map;

public record PageResult(List<Map<String,Object>> items,long total) {}
