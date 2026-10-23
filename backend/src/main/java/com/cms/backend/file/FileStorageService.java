package com.cms.backend.file;

import com.cms.backend.common.ApiException;
import com.cms.backend.common.Db;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("pdf", "png", "jpg", "jpeg", "doc", "docx", "txt", "zip", "xlsx", "csv");

    private final Db db;
    private final Path root;

    public FileStorageService(Db db, @Value("${app.upload-dir:./uploads}") String uploadDir) throws IOException {
        this.db = db;
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Map<String, Object> store(MultipartFile file, UUID uploadedBy) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("No file provided.");
        String original = file.getOriginalFilename() == null ? "file" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw ApiException.badRequest("File type ." + ext + " is not allowed. Allowed: " + String.join(", ", ALLOWED_EXTENSIONS));
        }
        UUID id = UUID.randomUUID();
        String storageName = id + "." + ext;
        try {
            Files.copy(file.getInputStream(), root.resolve(storageName));
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Could not store file.");
        }
        db.exec("INSERT INTO stored_files (id, original_name, content_type, size_bytes, storage_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)",
                id, original, file.getContentType(), file.getSize(), storageName, uploadedBy);
        return Map.of("id", id, "name", original, "url", "/api/files/" + id, "size", file.getSize());
    }

    public Map<String, Object> metadata(UUID id) {
        return db.one("SELECT id, original_name, content_type, storage_name FROM stored_files WHERE id = ?", "File not found.", id);
    }

    public Resource load(String storageName) {
        Path p = root.resolve(storageName).normalize();
        if (!p.startsWith(root) || !Files.exists(p)) throw ApiException.notFound("File not found.");
        return new FileSystemResource(p);
    }
}
