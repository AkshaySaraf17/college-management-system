package com.cms.backend.auth.dto;

import com.cms.backend.user.User;

public record AdminCreateUserResult(User user, String temporaryPassword) {
}
