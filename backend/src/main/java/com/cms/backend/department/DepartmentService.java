package com.cms.backend.department;

import com.cms.backend.common.ApiException;
import com.cms.backend.department.dto.DepartmentRequest;
import com.cms.backend.department.dto.DepartmentResponse;
import com.cms.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    public List<DepartmentResponse> listAll() {
        return departmentRepository.findAll().stream().map(DepartmentResponse::from).toList();
    }

    public DepartmentResponse getById(Long id) {
        return DepartmentResponse.from(findOrThrow(id));
    }

    @Transactional
    public DepartmentResponse create(DepartmentRequest request) {
        if (departmentRepository.existsByCode(request.code())) {
            throw ApiException.conflict("A department with code '" + request.code() + "' already exists.");
        }
        Department department = new Department();
        department.setName(request.name());
        department.setCode(request.code().toUpperCase());
        department.setEstablishedYear(request.establishedYear());
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Transactional
    public DepartmentResponse update(Long id, DepartmentRequest request) {
        Department department = findOrThrow(id);
        department.setName(request.name());
        department.setEstablishedYear(request.establishedYear());
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Transactional
    public DepartmentResponse assignHod(Long id, UUID userId) {
        Department department = findOrThrow(id);
        if (!userRepository.existsById(userId)) {
            throw ApiException.badRequest("No user found with id " + userId);
        }
        department.setHodUserId(userId);
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Transactional
    public void delete(Long id) {
        Department department = findOrThrow(id);
        departmentRepository.delete(department);
    }

    private Department findOrThrow(Long id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Department not found: " + id));
    }
}
