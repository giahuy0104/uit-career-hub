package vn.edu.uit.careerhub.controller;

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

import vn.edu.uit.careerhub.dto.request.PlacementTransitionRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.dto.response.PageMeta;
import vn.edu.uit.careerhub.dto.response.PlacementPageResponse;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.PlacementService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@Validated @RestController @RequestMapping("/api/v1/uit/placements")
public class PlacementController {
    private final PlacementService service;
    public PlacementController(PlacementService service){this.service=service;}
    @GetMapping PlacementPageResponse list(@AuthenticationPrincipal AuthPrincipal principal,@RequestParam(defaultValue="1") @Min(1) int page,
            @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) PlacementStatus status,@RequestParam(required=false) @Size(max=120) String query){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);var result=service.list(page,pageSize,status,query);
        return new PlacementPageResponse(result.items(),result.summary(),PageMeta.of(page,pageSize,result.total()));}
    @PostMapping("/{placementId}/start") ApiEnvelope<Map<String,Object>> start(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID placementId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody PlacementTransitionRequest input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.transition(principal.userId(),placementId,commandId,false,input,RequestMetadataFactory.from(request)));}
    @PostMapping("/{placementId}/complete") ApiEnvelope<Map<String,Object>> complete(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID placementId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody PlacementTransitionRequest input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.transition(principal.userId(),placementId,commandId,true,input,RequestMetadataFactory.from(request)));}
}
