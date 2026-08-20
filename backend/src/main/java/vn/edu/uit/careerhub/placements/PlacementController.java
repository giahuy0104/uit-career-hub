package vn.edu.uit.careerhub.placements;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.common.PageMeta;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Transition;

@Validated @RestController @RequestMapping("/api/v1/uit/placements")
public class PlacementController {
    private final PlacementRepository repository;private final PlacementService service;
    public PlacementController(PlacementRepository repository,PlacementService service){this.repository=repository;this.service=service;}
    @GetMapping PlacementPage list(@AuthenticationPrincipal AuthPrincipal principal,@RequestParam(defaultValue="1") @Min(1) int page,
            @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) Status status,@RequestParam(required=false) @Size(max=120) String query){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);var result=repository.list(page,pageSize,status,query);
        return new PlacementPage(result.items(),result.summary(),PageMeta.of(page,pageSize,result.total()));}
    @PostMapping("/{placementId}/start") ApiEnvelope<Map<String,Object>> start(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID placementId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody Transition input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.transition(principal.userId(),placementId,commandId,false,input,RequestMetadata.from(request)));}
    @PostMapping("/{placementId}/complete") ApiEnvelope<Map<String,Object>> complete(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID placementId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody Transition input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.transition(principal.userId(),placementId,commandId,true,input,RequestMetadata.from(request)));}
    record PlacementPage(List<Map<String,Object>> data,Map<String,Long> summary,PageMeta meta){}
}
