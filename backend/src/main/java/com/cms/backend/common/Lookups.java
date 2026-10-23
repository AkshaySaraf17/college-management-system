package com.cms.backend.common;

import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class Lookups {

    private final Db db;

    public Lookups(Db db) {
        this.db = db;
    }

    /** Accepts either a student UUID or a roll number. */
    public UUID studentId(String idOrRoll) {
        if (idOrRoll == null || idOrRoll.isBlank()) throw ApiException.badRequest("Student is required.");
        String q = idOrRoll.trim();
        try {
            UUID id = UUID.fromString(q);
            if (db.exists("SELECT 1 FROM students WHERE id = ?", id)) return id;
        } catch (IllegalArgumentException ignored) {
            // not a UUID: fall through to roll-number lookup
        }
        UUID id = db.scalar(UUID.class, "SELECT id FROM students WHERE roll_number = ?", q);
        if (id == null) throw ApiException.notFound("No student found for \"" + q + "\".");
        return id;
    }
}
