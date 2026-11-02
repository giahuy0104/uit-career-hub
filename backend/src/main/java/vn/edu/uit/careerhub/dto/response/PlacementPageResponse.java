package vn.edu.uit.careerhub.dto.response;

import java.util.List;
import java.util.Map;

public record PlacementPageResponse(List<Map<String,Object>> data,Map<String,Long> summary,PageMeta meta){}
