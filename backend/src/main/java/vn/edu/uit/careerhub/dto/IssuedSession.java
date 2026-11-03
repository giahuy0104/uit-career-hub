package vn.edu.uit.careerhub.dto;

import vn.edu.uit.careerhub.dto.response.SessionResponse;

public record IssuedSession(String refreshToken, SessionResponse session) {}
