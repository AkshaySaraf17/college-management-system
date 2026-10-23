package com.cms.backend.faculty;

import com.cms.backend.auth.AuthService;
import com.cms.backend.auth.dto.AdminCreateUserRequest;
import com.cms.backend.auth.dto.AdminCreateUserResult;
import com.cms.backend.common.ApiException;
import com.cms.backend.course.Batch;
import com.cms.backend.course.BatchRepository;
import com.cms.backend.course.Subject;
import com.cms.backend.course.SubjectRepository;
import com.cms.backend.department.Department;
import com.cms.backend.department.DepartmentRepository;
import com.cms.backend.faculty.dto.*;
import com.cms.backend.notification.NotificationService;
import com.cms.backend.user.User;
import com.cms.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Year;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FacultyService {

    private final FacultyRepository facultyRepository;
    private final FacultyDocumentRepository facultyDocumentRepository;
    private final FacultySubjectAllocationRepository allocationRepository;
    private final FacultyLeaveRepository leaveRepository;
    private final DepartmentRepository departmentRepository;
    private final BatchRepository batchRepository;
    private final SubjectRepository subjectRepository;
    private final UserRepository userRepository;
    private final NotificationService notifications;
    private final AuthService authService;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public FacultyRegisterResult register(FacultyRegisterRequest request) {
        Department department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> ApiException.badRequest("Department not found: " + request.departmentId()));

        AdminCreateUserRequest userRequest = new AdminCreateUserRequest();
        userRequest.setEmail(request.email());
        userRequest.setFirstName(request.firstName());
        userRequest.setLastName(request.lastName());
        userRequest.setPhone(request.phone());
        userRequest.setRole("FACULTY");
        AdminCreateUserResult result = authService.adminCreateUser(userRequest);
        User user = result.user();
        String temporaryPassword = result.temporaryPassword();

        Faculty faculty = new Faculty();
        faculty.setUser(user);
        faculty.setEmployeeCode(generateEmployeeCode());
        faculty.setDepartment(department);
        faculty.setDesignation(request.designation());
        faculty.setQualification(request.qualification());
        faculty.setDateOfJoining(request.dateOfJoining());
        faculty.setEmploymentType(EmploymentType.valueOf(request.employmentType().toUpperCase()));
        faculty = facultyRepository.save(faculty);

        return new FacultyRegisterResult(FacultyResponse.from(faculty), temporaryPassword);
    }

    public List<FacultyResponse> listAll() {
        return facultyRepository.findAll().stream().map(FacultyResponse::from).toList();
    }

    public List<FacultyResponse> listByDepartment(Long departmentId) {
        return facultyRepository.findByDepartmentId(departmentId).stream().map(FacultyResponse::from).toList();
    }

    public FacultyResponse getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.notFound("No account found for this email."));
        Faculty faculty = facultyRepository.findByUserId(user.getId())
                .orElseThrow(() -> ApiException.notFound("No faculty profile for this account."));
        return FacultyResponse.from(faculty);
    }

    public FacultyResponse getById(UUID id) {
        return FacultyResponse.from(findOrThrow(id));
    }

    @Transactional
    public FacultyResponse assignDepartment(UUID id, Long departmentId) {
        Faculty faculty = findOrThrow(id);
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> ApiException.badRequest("Department not found: " + departmentId));
        faculty.setDepartment(department);
        return FacultyResponse.from(facultyRepository.save(faculty));
    }

    @Transactional
    public FacultyDocumentResponse uploadDocument(UUID facultyId, DocumentUploadRequest request) {
        Faculty faculty = findOrThrow(facultyId);
        FacultyDocument document = new FacultyDocument();
        document.setFaculty(faculty);
        document.setDocType(request.docType().toUpperCase());
        document.setFileUrl(request.fileUrl());
        return FacultyDocumentResponse.from(facultyDocumentRepository.save(document));
    }

    public List<FacultyDocumentResponse> listDocuments(UUID facultyId) {
        return facultyDocumentRepository.findByFacultyId(facultyId).stream().map(FacultyDocumentResponse::from).toList();
    }

    @Transactional
    public void verifyDocument(Long documentId) {
        FacultyDocument document = facultyDocumentRepository.findById(documentId)
                .orElseThrow(() -> ApiException.notFound("Document not found: " + documentId));
        document.setVerified(true);
        facultyDocumentRepository.save(document);

        boolean allVerified = facultyDocumentRepository.findByFacultyId(document.getFaculty().getId())
                .stream().allMatch(FacultyDocument::isVerified);
        if (allVerified) {
            Faculty faculty = document.getFaculty();
            faculty.setDocumentsVerified(true);
            facultyRepository.save(faculty);
        }
    }

    @Transactional
    public SubjectAllocationResponse allocateSubject(SubjectAllocationRequest request) {
        Faculty faculty = findOrThrow(request.facultyId());
        Subject subject = subjectRepository.findById(request.subjectId())
                .orElseThrow(() -> ApiException.badRequest("Subject not found: " + request.subjectId()));
        Batch batch = batchRepository.findById(request.batchId())
                .orElseThrow(() -> ApiException.badRequest("Batch not found: " + request.batchId()));

        if (allocationRepository.existsBySubjectIdAndBatchIdAndAcademicYear(
                subject.getId(), batch.getId(), request.academicYear())) {
            throw ApiException.conflict("This subject is already allocated to a faculty for this batch and year.");
        }

        FacultySubjectAllocation allocation = new FacultySubjectAllocation();
        allocation.setFaculty(faculty);
        allocation.setSubject(subject);
        allocation.setBatch(batch);
        allocation.setAcademicYear(request.academicYear());
        return SubjectAllocationResponse.from(allocationRepository.save(allocation));
    }

    public List<SubjectAllocationResponse> listAllocations(UUID facultyId) {
        return allocationRepository.findByFacultyId(facultyId).stream().map(SubjectAllocationResponse::from).toList();
    }

    @Transactional
    public LeaveResponse applyLeave(UUID facultyId, LeaveRequest request) {
        Faculty faculty = findOrThrow(facultyId);
        if (request.endDate().isBefore(request.startDate())) {
            throw ApiException.badRequest("End date cannot be before start date.");
        }
        FacultyLeave leave = new FacultyLeave();
        leave.setFaculty(faculty);
        leave.setLeaveType(LeaveType.valueOf(request.leaveType().toUpperCase()));
        leave.setStartDate(request.startDate());
        leave.setEndDate(request.endDate());
        leave.setReason(request.reason());
        leave = leaveRepository.save(leave);
        UUID hod = faculty.getDepartment() != null ? faculty.getDepartment().getHodUserId() : null;
        String text = faculty.getUser().getFullName() + " requested " + request.leaveType().toLowerCase() + " leave from "
                + request.startDate() + " to " + request.endDate() + ".";
        if (hod != null) {
            notifications.notifyUser(hod, "Leave request", text, "LEAVE", "/faculty/" + faculty.getId());
        } else {
            notifications.notifyRole("COLLEGE_ADMIN", "Leave request", text, "LEAVE", "/faculty/" + faculty.getId());
        }
        return LeaveResponse.from(leave);
    }

    public List<LeaveResponse> listLeaves(UUID facultyId) {
        return leaveRepository.findByFacultyId(facultyId).stream().map(LeaveResponse::from).toList();
    }

    @Transactional
    public LeaveResponse decideLeave(Long leaveId, boolean approve) {
        FacultyLeave leave = leaveRepository.findById(leaveId)
                .orElseThrow(() -> ApiException.notFound("Leave request not found: " + leaveId));
        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw ApiException.conflict("This leave request has already been " + leave.getStatus().name().toLowerCase() + ".");
        }
        leave.setStatus(approve ? LeaveStatus.APPROVED : LeaveStatus.REJECTED);
        leave = leaveRepository.save(leave);
        notifications.notifyUser(leave.getFaculty().getUser().getId(), "Leave " + (approve ? "approved" : "rejected"),
                "Your leave from " + leave.getStartDate() + " to " + leave.getEndDate() + " was " + (approve ? "approved." : "rejected."),
                "LEAVE", "/faculty/me");
        return LeaveResponse.from(leave);
    }

    private Faculty findOrThrow(UUID id) {
        return facultyRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Faculty not found: " + id));
    }

    private String generateEmployeeCode() {
        String candidate;
        do {
            candidate = "FAC" + Year.now().getValue() + String.format("%04d", random.nextInt(10_000));
        } while (facultyRepository.existsByEmployeeCode(candidate));
        return candidate;
    }
}
