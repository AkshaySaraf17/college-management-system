package com.cms.backend.file;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileStorageService storage;
    private final AccessService access;

    public FileController(FileStorageService storage, AccessService access) {
        this.storage = storage;
        this.access = access;
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("File uploaded.", storage.store(file, access.userId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> download(@PathVariable UUID id) {
        Map<String, Object> meta = storage.metadata(id);
        String name = (String) meta.get("originalName");
        String type = meta.get("contentType") != null ? (String) meta.get("contentType") : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        boolean inline = type.equals("application/pdf") || type.startsWith("image/");
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(name, StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(type))
                .body(storage.load((String) meta.get("storageName")));
    }
}
