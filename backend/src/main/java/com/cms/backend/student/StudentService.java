package com.cms.backend.student;

import com.cms.backend.admission.AdmissionApplication;
import com.cms.backend.auth.AuthService;
import com.cms.backend.auth.dto.AdminCreateUserRequest;
import com.cms.backend.auth.dto.AdminCreateUserResult;
import com.cms.backend.common.ApiException;
import com.cms.backend.course.Batch;
import com.cms.backend.course.Semester;
import com.cms.backend.course.SemesterRepository;
import com.cms.backend.student.dto.*;
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
public class StudentService {

    private final StudentRepository studentRepository;
    private final ParentRepository parentRepository;
    private final StudentParentRepository studentParentRepository;
    private final StudentAcademicHistoryRepository academicHistoryRepository;
    private final StudentDocumentRepository studentDocumentRepository;
    private final SemesterRepository semesterRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final SecureRandom random = new SecureRandom();

    /**
     * Final step of the admission workflow: creates the student's login, generates their
     * roll number / ID card number, and enrolls them into the first semester of the course.
     */
    public record EnrollmentResult(StudentResponse student, String temporaryPassword) {}

    @Transactional
    public EnrollmentResult enrollFromAdmission(AdmissionApplication admission, Batch batch) {
        AdminCreateUserRequest userRequest = new AdminCreateUserRequest();
        userRequest.setEmail(admission.getEmail());
        userRequest.setFirstName(admission.getFirstName());
        userRequest.setLastName(admission.getLastName());
        userRequest.setPhone(admission.getPhone());
        userRequest.setRole("STUDENT");
        AdminCreateUserResult result = authService.adminCreateUser(userRequest);
        User user = result.user();

        Semester firstSemester = semesterRepository.findByCourseIdOrderByNumber(admission.getCourse().getId())
                .stream().findFirst().orElse(null);

        Student student = new Student();
        student.setUser(user);
        student.setAdmission(admission);
        student.setRollNumber(generateRollNumber(batch));
        student.setIdCardNumber(generateIdCardNumber());
        student.setCourse(admission.getCourse());
        student.setBatch(batch);
        student.setCurrentSemester(firstSemester);
        student.setDateOfBirth(admission.getDateOfBirth());
        student.setGender(admission.getGender());
        student.setAddress(admission.getAddress());
        student = studentRepository.save(student);

        if (admission.getGuardianName() != null && !admission.getGuardianName().isBlank()) {
            Parent parent = new Parent();
            String[] parts = admission.getGuardianName().trim().split(" ", 2);
            parent.setFirstName(parts[0]);
            parent.setLastName(parts.length > 1 ? parts[1] : "");
            parent.setRelation(ParentRelation.GUARDIAN);
            parent.setPhone(admission.getGuardianPhone() != null ? admission.getGuardianPhone() : "");
            parent.setEmail(admission.getGuardianEmail());
            parent = parentRepository.save(parent);
            studentParentRepository.save(new StudentParent(student, parent, true));
        }

        return new EnrollmentResult(StudentResponse.from(student), result.temporaryPassword());
    }

    public List<StudentResponse> listAll() {
        return studentRepository.findAll().stream().map(StudentResponse::from).toList();
    }

    public List<StudentResponse> listByCourse(Long courseId) {
        return studentRepository.findByCourseId(courseId).stream().map(StudentResponse::from).toList();
    }

    public List<StudentResponse> listByBatch(Long batchId) {
        return studentRepository.findByBatchId(batchId).stream().map(StudentResponse::from).toList();
    }

    public StudentResponse getById(UUID id) {
        return StudentResponse.from(findOrThrow(id));
    }

    public StudentResponse getByUserId(UUID userId) {
        Student student = studentRepository.findByUserId(userId)
                .orElseThrow(() -> ApiException.notFound("No student profile for this account."));
        return StudentResponse.from(student);
    }

    public StudentResponse getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.notFound("No account found for this email."));
        return getByUserId(user.getId());
    }

    @Transactional
    public StudentResponse promoteToSemester(UUID studentId, Long semesterId) {
        Student student = findOrThrow(studentId);
        Semester semester = semesterRepository.findById(semesterId)
                .orElseThrow(() -> ApiException.badRequest("Semester not found: " + semesterId));
        if (!semester.getCourse().getId().equals(student.getCourse().getId())) {
            throw ApiException.badRequest("Semester does not belong to the student's course.");
        }
        student.setCurrentSemester(semester);
        return StudentResponse.from(studentRepository.save(student));
    }

    @Transactional
    public StudentResponse updateStatus(UUID studentId, String status) {
        Student student = findOrThrow(studentId);
        student.setStatus(StudentStatus.valueOf(status.toUpperCase()));
        return StudentResponse.from(studentRepository.save(student));
    }

    @Transactional
    public ParentResponse addParent(UUID studentId, ParentRequest request) {
        Student student = findOrThrow(studentId);
        Parent parent = new Parent();
        parent.setFirstName(request.firstName());
        parent.setLastName(request.lastName());
        parent.setRelation(ParentRelation.valueOf(request.relation().toUpperCase()));
        parent.setPhone(request.phone());
        parent.setEmail(request.email());
        parent.setOccupation(request.occupation());
        parent = parentRepository.save(parent);
        studentParentRepository.save(new StudentParent(student, parent, request.primaryContact()));
        return ParentResponse.from(parent, request.primaryContact());
    }

    public List<ParentResponse> listParents(UUID studentId) {
        return studentParentRepository.findByStudentId(studentId).stream()
                .map(sp -> ParentResponse.from(sp.getParent(), sp.isPrimaryContact()))
                .toList();
    }

    @Transactional
    public AcademicHistoryResponse recordSemesterResult(UUID studentId, Long semesterId, String status, java.math.BigDecimal sgpa) {
        Student student = findOrThrow(studentId);
        Semester semester = semesterRepository.findById(semesterId)
                .orElseThrow(() -> ApiException.badRequest("Semester not found: " + semesterId));

        StudentAcademicHistory history = new StudentAcademicHistory();
        history.setStudent(student);
        history.setSemester(semester);
        history.setStatus(AcademicHistoryStatus.valueOf(status.toUpperCase()));
        history.setSgpa(sgpa);
        return AcademicHistoryResponse.from(academicHistoryRepository.save(history));
    }

    public List<AcademicHistoryResponse> listAcademicHistory(UUID studentId) {
        return academicHistoryRepository.findByStudentIdOrderBySemesterIdAsc(studentId).stream()
                .map(AcademicHistoryResponse::from).toList();
    }

    @Transactional
    public StudentDocumentResponse uploadDocument(UUID studentId, StudentDocumentRequest request) {
        Student student = findOrThrow(studentId);
        StudentDocument document = new StudentDocument();
        document.setStudent(student);
        document.setDocType(request.docType().toUpperCase());
        document.setFileUrl(request.fileUrl());
        return StudentDocumentResponse.from(studentDocumentRepository.save(document));
    }

    public List<StudentDocumentResponse> listDocuments(UUID studentId) {
        return studentDocumentRepository.findByStudentId(studentId).stream()
                .map(StudentDocumentResponse::from).toList();
    }

    private Student findOrThrow(UUID id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Student not found: " + id));
    }

    private String generateRollNumber(Batch batch) {
        String candidate;
        long sequence = studentRepository.countByCourseId(batch.getCourse().getId()) + 1;
        do {
            candidate = batch.getCourse().getCode() + "-" + batch.getStartYear() + "-" + String.format("%04d", sequence++);
        } while (studentRepository.existsByRollNumber(candidate));
        return candidate;
    }

    private String generateIdCardNumber() {
        String candidate;
        do {
            candidate = "STU" + Year.now().getValue() + String.format("%05d", random.nextInt(100_000));
        } while (studentRepository.existsByIdCardNumber(candidate));
        return candidate;
    }
}
