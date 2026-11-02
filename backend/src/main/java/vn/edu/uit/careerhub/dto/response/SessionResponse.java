package vn.edu.uit.careerhub.dto.response;

import vn.edu.uit.careerhub.dto.UserDto;

public record SessionResponse(String accessToken, long expiresIn, UserDto user) {}
