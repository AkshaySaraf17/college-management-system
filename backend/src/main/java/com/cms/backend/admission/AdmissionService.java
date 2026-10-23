package com.cms.backend.admission;

import com.cms.backend.admission.dto.*;
import com.cms.backend.common.ApiException;
import com.cms.backend.course.Batch;
import com.cms.backend.course.BatchRepository;
import com.cms.backend.course.Course;
import com.cms.backend.course.CourseRepository;
import com.cms.backend.student.StudentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.Year;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdmissionService {

    private final AdmissionApplicationRepository applicationRepository;
    private final AdmissionDocumentRepository documentRepository;
    private final CourseRepository courseRepository;
    private final BatchRepository batchRepository;
    private final StudentService studentService;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public AdmissionResponse apply(AdmissionApplyRequest request) {
        Course course = courseRepository.findById(request.courseId())
                .orElseThrow(() -> ApiException.badRequest("Course not found: " + request.courseId()));

        AdmissionApplication application = new AdmissionApplication();
        application.setApplicationNumber(generateApplicationNumber());
        application.setCourse(course);
        application.setFirstName(request.firstName());
        application.setLastName(request.lastName());
        application.setEmail(request.email());
        application.setPhone(request.phone());
        application.setDateOfBirth(request.dateOfBirth());
        application.setGender(request.gender());
        application.setAddress(request.address());
        application.setGuardianName(request.guardianName());
        application.setGuardianPhone(request.guardianPhone());
        application.setGuardianEmail(request.guardianEmail());
        application.setPriorEducationJson(request.priorEducationJson());
        application.setStatus(AdmissionStatus.SUBMITTED);

        return AdmissionResponse.from(applicationRepository.save(application));
    }

    public List<AdmissionResponse> listAll() {
        return applicationRepository.findAll().stream().map(AdmissionResponse::from).toList();
    }

    public List<AdmissionResponse> listByCourse(Long courseId) {
        return applicationRepository.findByCourseId(courseId).stream().map(AdmissionResponse::from).toList();
    }

    public AdmissionResponse getById(UUID id) {
        return AdmissionResponse.from(findOrThrow(id));
    }

    public AdmissionResponse getByApplicationNumber(String applicationNumber) {
        return applicationRepository.findByApplicationNumber(applicationNumber)
                .map(AdmissionResponse::from)
                .orElseThrow(() -> ApiException.notFound("No application found with number " + applicationNumber));
    }

    @Transactional
    public AdmissionDocumentResponse uploadDocument(UUID applicationId, String docType, String fileUrl) {
        AdmissionApplication application = findOrThrow(applicationId);
        AdmissionDocument document = new AdmissionDocument();
        document.setApplication(application);
        document.setDocType(docType.toUpperCase());
        document.setFileUrl(fileUrl);
        if (application.getStatus() == AdmissionStatus.SUBMITTED) {
            application.setStatus(AdmissionStatus.DOCUMENTS_PENDING);
            applicationRepository.save(application);
        }
        return AdmissionDocumentResponse.from(documentRepository.save(document));
    }

    public List<AdmissionDocumentResponse> listDocuments(UUID applicationId) {
        return documentRepository.findByApplicationId(applicationId).stream()
                .map(AdmissionDocumentResponse::from).toList();
    }

    @Transactional
    public AdmissionResponse review(UUID id, ReviewRequest request) {
        AdmissionApplication application = findOrThrow(id);
        if (request.entranceExamScore() != null) {
            application.setEntranceExamScore(request.entranceExamScore());
        }
        application.setReviewNotes(request.notes());
        application.setReviewedAt(Instant.now());
        application.setStatus(AdmissionStatus.UNDER_REVIEW);
        return AdmissionResponse.from(applicationRepository.save(application));
    }

    @Transactional
    public AdmissionResponse reject(UUID id, String notes) {
        AdmissionApplication application = findOrThrow(id);
        application.setStatus(AdmissionStatus.REJECTED);
        application.setReviewNotes(notes);
        application.setReviewedAt(Instant.now());
        return AdmissionResponse.from(applicationRepository.save(application));
    }

    /**
     * Ranks every application under review for a course by entrance exam score and marks
     * them MERIT_LISTED with a rank, matching the "Merit List Generation" step of the workflow.
     */
    @Transactional
    public List<AdmissionResponse> generateMeritList(Long courseId) {
        List<AdmissionApplication> candidates = applicationRepository.findByCourseIdAndStatusIn(
                courseId, List.of(AdmissionStatus.UNDER_REVIEW, AdmissionStatus.SHORTLISTED));

        candidates.sort(Comparator.comparing(
                (AdmissionApplication a) -> a.getEntranceExamScore() != null ? a.getEntranceExamScore() : BigDecimal.ZERO
        ).reversed());

        int rank = 1;
        for (AdmissionApplication application : candidates) {
            application.setMeritScore(application.getEntranceExamScore());
            application.setMeritRank(rank++);
            application.setStatus(AdmissionStatus.MERIT_LISTED);
        }
        applicationRepository.saveAll(candidates);
        return candidates.stream().map(AdmissionResponse::from).toList();
    }

    @Transactional
    public AdmissionResponse approve(UUID id) {
        AdmissionApplication application = findOrThrow(id);
        if (application.getStatus() != AdmissionStatus.MERIT_LISTED) {
            throw ApiException.badRequest("Only merit-listed applications can be approved. Current status: " + application.getStatus());
        }
        application.setStatus(AdmissionStatus.FEE_PENDING);
        return AdmissionResponse.from(applicationRepository.save(application));
    }

    @Transactional
    public AdmissionResponse recordFeePayment(UUID id, FeePaymentRequest request) {
        AdmissionApplication application = findOrThrow(id);
        if (application.getStatus() != AdmissionStatus.FEE_PENDING) {
            throw ApiException.badRequest("Admission fee can only be recorded once the application is approved for payment.");
        }
        application.setAdmissionFeePaid(true);
        application.setAdmissionFeeAmount(request.amount());
        application.setStatus(AdmissionStatus.APPROVED);
        return AdmissionResponse.from(applicationRepository.save(application));
    }

    /** Final step: generates the student login, roll number and ID card. */
    @Transactional
    public Map<String, Object> enroll(UUID id, Long batchId) {
        AdmissionApplication application = findOrThrow(id);
        if (application.getStatus() != AdmissionStatus.APPROVED || !application.isAdmissionFeePaid()) {
            throw ApiException.badRequest("Application must be APPROVED with the admission fee paid before enrollment.");
        }
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> ApiException.badRequest("Batch not found: " + batchId));
        if (!batch.getCourse().getId().equals(application.getCourse().getId())) {
            throw ApiException.badRequest("Batch does not belong to the applicant's course.");
        }

        StudentService.EnrollmentResult result = studentService.enrollFromAdmission(application, batch);

        application.setStatus(AdmissionStatus.ENROLLED);
        application.setEnrolledStudentId(result.student().id());
        applicationRepository.save(application);

        return Map.of(
                "student", result.student(),
                "temporaryPassword", result.temporaryPassword()
        );
    }

    @Transactional
    public AdmissionResponse withdraw(UUID id) {
        AdmissionApplication application = findOrThrow(id);
        application.setStatus(AdmissionStatus.WITHDRAWN);
        return AdmissionResponse.from(applicationRepository.save(application));
    }

    private AdmissionApplication findOrThrow(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Admission application not found: " + id));
    }

    private String generateApplicationNumber() {
        String candidate;
        do {
            candidate = "ADM" + Year.now().getValue() + String.format("%06d", random.nextInt(1_000_000));
        } while (applicationRepository.existsByApplicationNumber(candidate));
        return candidate;
    }
}
