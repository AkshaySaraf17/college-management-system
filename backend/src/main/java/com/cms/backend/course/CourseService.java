package com.cms.backend.course;

import com.cms.backend.common.ApiException;
import com.cms.backend.course.dto.*;
import com.cms.backend.department.Department;
import com.cms.backend.department.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final DepartmentRepository departmentRepository;
    private final BatchRepository batchRepository;
    private final SemesterRepository semesterRepository;
    private final SubjectRepository subjectRepository;
    private final AcademicCalendarEventRepository calendarEventRepository;

    // ----- Courses -----

    public List<CourseResponse> listCourses() {
        return courseRepository.findAll().stream().map(CourseResponse::from).toList();
    }

    public CourseResponse getCourse(Long id) {
        return CourseResponse.from(findCourseOrThrow(id));
    }

    @Transactional
    public CourseResponse createCourse(CourseRequest request) {
        if (courseRepository.existsByCode(request.code())) {
            throw ApiException.conflict("A course with code '" + request.code() + "' already exists.");
        }
        Department department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> ApiException.badRequest("Department not found: " + request.departmentId()));

        Course course = new Course();
        course.setDepartment(department);
        course.setName(request.name());
        course.setCode(request.code().toUpperCase());
        course.setLevel(CourseLevel.valueOf(request.level().toUpperCase()));
        course.setDurationYears(request.durationYears());
        course.setTotalSemesters(request.totalSemesters());
        course.setTotalSeats(request.totalSeats() != null ? request.totalSeats() : 0);
        course = courseRepository.save(course);

        // Auto-generate the semester shells so subjects can be attached immediately.
        for (int i = 1; i <= request.totalSemesters(); i++) {
            Semester semester = new Semester();
            semester.setCourse(course);
            semester.setNumber(i);
            semester.setName("Semester " + i);
            semesterRepository.save(semester);
        }

        return CourseResponse.from(course);
    }

    @Transactional
    public void deleteCourse(Long id) {
        courseRepository.delete(findCourseOrThrow(id));
    }

    // ----- Batches -----

    public List<BatchResponse> listBatches(Long courseId) {
        return batchRepository.findByCourseId(courseId).stream().map(BatchResponse::from).toList();
    }

    @Transactional
    public BatchResponse createBatch(BatchRequest request) {
        Course course = findCourseOrThrow(request.courseId());
        Batch batch = new Batch();
        batch.setCourse(course);
        batch.setName(request.name());
        batch.setStartYear(request.startYear());
        batch.setEndYear(request.endYear());
        return BatchResponse.from(batchRepository.save(batch));
    }

    // ----- Semesters -----

    public List<SemesterResponse> listSemesters(Long courseId) {
        return semesterRepository.findByCourseIdOrderByNumber(courseId).stream().map(SemesterResponse::from).toList();
    }

    // ----- Subjects -----

    public List<SubjectResponse> listSubjects(Long semesterId) {
        return subjectRepository.findBySemesterId(semesterId).stream().map(SubjectResponse::from).toList();
    }

    @Transactional
    public SubjectResponse createSubject(SubjectRequest request) {
        if (subjectRepository.existsByCode(request.code())) {
            throw ApiException.conflict("A subject with code '" + request.code() + "' already exists.");
        }
        Semester semester = semesterRepository.findById(request.semesterId())
                .orElseThrow(() -> ApiException.badRequest("Semester not found: " + request.semesterId()));

        Subject subject = new Subject();
        subject.setSemester(semester);
        subject.setName(request.name());
        subject.setCode(request.code().toUpperCase());
        subject.setCredits(request.credits());
        subject.setElective(request.elective());
        return SubjectResponse.from(subjectRepository.save(subject));
    }

    @Transactional
    public void deleteSubject(Long id) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Subject not found: " + id));
        subjectRepository.delete(subject);
    }

    // ----- Academic calendar -----

    public List<CalendarEventResponse> listCalendarEvents() {
        return calendarEventRepository.findAll().stream().map(CalendarEventResponse::from).toList();
    }

    @Transactional
    public CalendarEventResponse createCalendarEvent(CalendarEventRequest request) {
        AcademicCalendarEvent event = new AcademicCalendarEvent();
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setEventType(CalendarEventType.valueOf(request.eventType().toUpperCase()));
        event.setStartDate(request.startDate());
        event.setEndDate(request.endDate());
        if (request.departmentId() != null) {
            Department department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> ApiException.badRequest("Department not found: " + request.departmentId()));
            event.setDepartment(department);
        }
        return CalendarEventResponse.from(calendarEventRepository.save(event));
    }

    private Course findCourseOrThrow(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Course not found: " + id));
    }
}
