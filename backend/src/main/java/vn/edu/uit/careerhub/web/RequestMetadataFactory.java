package vn.edu.uit.careerhub.web;

import jakarta.servlet.http.HttpServletRequest;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.filter.ClientIpFilter;

public final class RequestMetadataFactory {
    private RequestMetadataFactory() {}

    public static RequestMetadata from(HttpServletRequest request) {
        String userAgent = request.getHeader("user-agent");
        if (userAgent != null && userAgent.length() > 512) userAgent = userAgent.substring(0, 512);
        Object resolved = request.getAttribute(ClientIpFilter.ATTRIBUTE);
        String ip = resolved != null ? resolved.toString() : ClientIpFilter.resolve(null, request.getRemoteAddr(), 0);
        return new RequestMetadata(ip, userAgent);
    }
}
