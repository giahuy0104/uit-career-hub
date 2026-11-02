package vn.edu.uit.careerhub.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.service.DailyPendingService;

@RestController @RequestMapping("/api/v1/cron")
public class DailyPendingController {
    private final DailyPendingService service;private final AppProperties properties;
    public DailyPendingController(DailyPendingService service,AppProperties properties){this.service=service;this.properties=properties;}
    @GetMapping("/daily-pending-notifications") ApiEnvelope<Map<String,Object>> run(@RequestHeader(value="Authorization",required=false) String authorization){
        String expected="Bearer "+properties.cronSecret();if(properties.cronSecret()==null||properties.cronSecret().isBlank()||authorization==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),authorization.getBytes(StandardCharsets.UTF_8)))throw new AppException(ErrorType.UNAUTHENTICATED,"CRON_UNAUTHORIZED","Cron request không hợp lệ.");
        return ApiEnvelope.of(service.run());
    }
}
