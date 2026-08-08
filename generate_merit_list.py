import sys
import datetime
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Circle, String, Group, Rect
from reportlab.pdfgen import canvas

# ==========================================
# 1. KNEC CBE CBE GRADETABLE & CALCULATIONS
# ==========================================

def get_knec_grade(mark):
    """
    Official KNEC 8-point CBE Grade scale:
    90-100: EE1 (8 pts)
    75-89:  EE2 (7 pts)
    58-74:  ME1 (6 pts)
    41-57:  ME2 (5 pts)
    31-40:  AE1 (4 pts)
    21-30:  AE2 (3 pts)
    11-20:  BE1 (2 pts)
    0-10:   BE2 (1 pt)
    """
    if mark is None or mark == '':
        return None, 0
    try:
        m = float(mark)
    except ValueError:
        return None, 0

    if m >= 90:
        return 'EE1', 8
    elif m >= 75:
        return 'EE2', 7
    elif m >= 58:
        return 'ME1', 6
    elif m >= 41:
        return 'ME2', 5
    elif m >= 31:
        return 'AE1', 4
    elif m >= 21:
        return 'AE2', 3
    elif m >= 11:
        return 'BE1', 2
    else:
        return 'BE2', 1

def calculate_competition_ranks(students_data):
    """
    Computes standard competition ranking (1, 1, 3 for ties) based on total marks.
    Provisional / unassessed students receive '-' for ranks.
    """
    # Filter assessed vs provisional
    assessed = [s for s in students_data if s.get('is_assessed', True)]
    
    # Sort assessed by total marks descending
    assessed.sort(key=lambda s: s['total_marks'], reverse=True)

    # Calculate overall positions
    rank = 1
    for i, student in enumerate(assessed):
        if i > 0 and student['total_marks'] == assessed[i - 1]['total_marks']:
            student['overall_pos'] = assessed[i - 1]['overall_pos']
        else:
            student['overall_pos'] = rank
        rank = i + 2  # standard competition ranking

    # Calculate stream positions
    streams = set(s['stream'] for s in assessed if s.get('stream'))
    for st in streams:
        stream_students = [s for s in assessed if s['stream'] == st]
        st_rank = 1
        for i, student in enumerate(stream_students):
            if i > 0 and student['total_marks'] == stream_students[i - 1]['total_marks']:
                student['stream_pos'] = stream_students[i - 1]['stream_pos']
            else:
                student['stream_pos'] = st_rank
            st_rank = i + 2

    # Set '-' for provisional students
    for s in students_data:
        if not s.get('is_assessed', True):
            s['overall_pos'] = '-'
            s['stream_pos'] = '-'
            if 'prv_str_pos' not in s: s['prv_str_pos'] = '-'
            if 'prv_ovr_pos' not in s: s['prv_ovr_pos'] = '-'

    return students_data

# ==========================================
# 2. PAGE NUMBERING & FOOTER CANVAS
# ==========================================

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))
        now_str = datetime.datetime.now().strftime("%d.%m.%Y: at %H:%M:%S")
        footer_text = f"Report generated on: {now_str} Page {self._pageNumber}/{page_count}"
        self.drawRightString(836.8 + 2.54, 12, footer_text)
        self.restoreState()

# ==========================================
# 3. MAIN PDF GENERATOR SCRIPT
# ==========================================

def create_school_badge():
    """Generates a circular school logo drawing."""
    d = Drawing(44, 44)
    # Background circle
    d.add(Circle(22, 22, 20, fillColor=colors.HexColor("#006666"), strokeColor=colors.HexColor("#004D4D"), strokeWidth=1))
    # Inner ring
    d.add(Circle(22, 22, 16, fillColor=colors.white, strokeColor=colors.HexColor("#006666"), strokeWidth=1))
    # Text logo initials
    d.add(String(14, 17, "MCS", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor("#006666")))
    return d

def generate_merit_list_pdf(filename, school_info, exam_info, students_raw_data, subjects_list):
    """
    Generates A4 Landscape Merit List PDF matching exact specs.
    """
    # Page setup: A4 Landscape (841.89 x 595.28 pt)
    page_width, page_height = landscape(A4) # 841.89, 595.28
    
    # Exact column widths (24 columns total = 836.8 pt)
    col_widths = [
        19.8,  # 0: S.No
        28.3,  # 1: ADM No.
        107.7, # 2: STUDENT NAME
        59.5,  # 3: ASS NO
        73.7,  # 4: STREAM
        17.0,  # 5: STREAM POS
        17.0,  # 6: OVERALL POS
        17.0,  # 7: PRV STR POS
        17.0,  # 8: PRV OVR POS
        # 9-17: 9 Subjects @ 35.0pt each = 315.0pt
        35.0, 35.0, 35.0, 35.0, 35.0, 35.0, 35.0, 35.0, 35.0,
        19.8,  # 18: SUB. ENTRY
        25.5,  # 19: TOTAL MARKS
        25.5,  # 20: AVG MARKS
        28.4,  # 21: TOTAL POINTS
        28.3,  # 22: AVG POINTS
        28.3,  # 23: LEVEL
    ]
    total_table_w = sum(col_widths) # 836.8 pt
    side_margin = (page_width - total_table_w) / 2.0 # ~2.54 pt

    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        leftMargin=side_margin,
        rightMargin=side_margin,
        topMargin=15,
        bottomMargin=25
    )

    styles = getSampleStyleSheet()

    # Define custom paragraph styles for crisp layout
    title_style = ParagraphStyle(
        'SchoolTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=17,
        textColor=colors.HexColor('#006666')
    )
    
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    meta_label_style = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155')
    )

    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0055CC')
    )

    tbl_hdr_style = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=7.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0F172A')
    )

    tbl_cell_center = ParagraphStyle(
        'TblCellCenter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=7.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0F172A')
    )

    tbl_cell_left = ParagraphStyle(
        'TblCellLeft',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=7.5,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#0F172A')
    )

    tbl_cell_blue_bold = ParagraphStyle(
        'TblCellBlueBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=7.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0055CC')
    )

    story = []

    # ==========================================
    # HEADER BLOCK (School Logo + Meta)
    # ==========================================
    badge = create_school_badge()
    
    meta_p = Paragraph(
        f"<b>CLASS:</b> <font color='#0055CC'>{exam_info['class']}</font> &nbsp;&nbsp;&nbsp;&nbsp; "
        f"<b>TERM:</b> <font color='#0055CC'>{exam_info['term']}</font> &nbsp;&nbsp;&nbsp;&nbsp; "
        f"<b>YEAR:</b> <font color='#0055CC'>{exam_info['year']}</font> &nbsp;&nbsp;&nbsp;&nbsp; "
        f"<b>EXAM NAME:</b> <font color='#0055CC'>{exam_info['exam_name']}</font> &nbsp;&nbsp;&nbsp;&nbsp; "
        f"<b>EXAM CODE:</b> <font color='#0055CC'>{exam_info['exam_code']}</font>",
        meta_label_style
    )

    header_table_data = [
        [badge, Paragraph(f"<b>{school_info['name']}</b>", title_style)],
        ['', Paragraph(f"REPORT: {school_info['report_title']}", subtitle_style)],
        ['', meta_p]
    ]

    header_table = Table(header_table_data, colWidths=[50, total_table_w - 50])
    header_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
    ]))

    story.append(header_table)
    story.append(Spacer(1, 6))

    # ==========================================
    # DATA PROCESSING (Averaging & Denominator Bug Fix)
    # ==========================================
    processed_students = []
    
    for idx, raw_s in enumerate(students_raw_data):
        subj_marks = raw_s.get('marks', {})
        assessed_entries = 0
        total_m = 0
        total_p = 0
        
        formatted_marks = {}
        for code in subjects_list:
            m = subj_marks.get(code)
            if m is not None and m != '':
                grade, pts = get_knec_grade(m)
                formatted_marks[code] = {'mark': int(m), 'grade': grade, 'points': pts}
                assessed_entries += 1
                total_m += int(m)
                total_p += pts
            else:
                formatted_marks[code] = None

        is_assessed = (assessed_entries > 0)
        
        if is_assessed:
            avg_m = total_m / float(assessed_entries)
            avg_p = total_p / float(assessed_entries)
            overall_grade, _ = get_knec_grade(avg_m)
        else:
            avg_m = 0.0
            avg_p = 0.0
            overall_grade = 'BE2'

        processed_students.append({
            's_no': idx + 1,
            'adm_no': raw_s['adm_no'],
            'name': raw_s['name'],
            'ass_no': raw_s.get('ass_no', '-'),
            'stream': raw_s['stream'],
            'prv_str_pos': raw_s.get('prv_str_pos', '-'),
            'prv_ovr_pos': raw_s.get('prv_ovr_pos', '-'),
            'marks': formatted_marks,
            'sub_entry': assessed_entries,
            'total_marks': total_m,
            'avg_marks': avg_m,
            'total_points': total_p,
            'avg_points': avg_p,
            'level': overall_grade,
            'is_assessed': is_assessed
        })

    # Sort & Rank
    processed_students = calculate_competition_ranks(processed_students)

    # Class-wide stats (CRITICAL BUG FIX: Exclude unassessed students from denominator!)
    assessed_students = [s for s in processed_students if s['is_assessed']]
    count_assessed = len(assessed_students)

    subject_sums = {code: {'marks': 0, 'points': 0, 'count': 0} for code in subjects_list}
    for s in assessed_students:
        for code in subjects_list:
            if s['marks'][code] is not None:
                subject_sums[code]['marks'] += s['marks'][code]['mark']
                subject_sums[code]['points'] += s['marks'][code]['points']
                subject_sums[code]['count'] += 1

    subject_stats = {}
    for code in subjects_list:
        cnt = subject_sums[code]['count']
        if cnt > 0:
            avg_m = subject_sums[code]['marks'] / float(cnt)
            avg_p = subject_sums[code]['points'] / float(cnt)
            grd, _ = get_knec_grade(avg_m)
        else:
            avg_m = 0.0
            avg_p = 0.0
            grd = 'BE2'
        subject_stats[code] = {'avg_marks': avg_m, 'avg_points': avg_p, 'grade': grd}

    if count_assessed > 0:
        class_tot_averages = sum(s['avg_marks'] for s in assessed_students)
        overall_class_avg_pct = class_tot_averages / float(count_assessed)
        
        class_tot_pts = sum(s['avg_points'] for s in assessed_students)
        overall_class_avg_pts = class_tot_pts / float(count_assessed)
        overall_class_level, _ = get_knec_grade(overall_class_avg_pct)

        class_tot_raw = sum(s['total_marks'] for s in assessed_students)
        class_avg_raw_marks = class_tot_raw / float(count_assessed)
    else:
        overall_class_avg_pct = 0.0
        overall_class_avg_pts = 0.0
        overall_class_level = 'BE2'
        class_avg_raw_marks = 0.0

    # ==========================================
    # BUILD MAIN TABLE
    # ==========================================
    table_data = []

    # 1. Header Row
    header_cells = [
        Paragraph("<b>S.No</b>", tbl_hdr_style),
        Paragraph("<b>ADM<br/>No.</b>", tbl_hdr_style),
        Paragraph("<b>STUDENT NAME</b>", tbl_hdr_style),
        Paragraph("<b>ASS NO</b>", tbl_hdr_style),
        Paragraph("<b>STREAM</b>", tbl_hdr_style),
        Paragraph("<b>STREAM<br/>POS</b>", tbl_hdr_style),
        Paragraph("<b>OVERALL<br/>POS</b>", tbl_hdr_style),
        Paragraph("<b>PRV STR<br/>POS</b>", tbl_hdr_style),
        Paragraph("<b>PRV OVR<br/>POS</b>", tbl_hdr_style),
    ]

    # Subject headers
    for code in subjects_list:
        header_cells.append(Paragraph(f"<b>{code}</b>", tbl_hdr_style))

    # Summary headers
    header_cells.extend([
        Paragraph("<b>SUB.<br/>ENTRY</b>", tbl_hdr_style),
        Paragraph("<b>TOTAL<br/>MARKS</b>", tbl_hdr_style),
        Paragraph("<b>AVG<br/>MARKS</b>", tbl_hdr_style),
        Paragraph("<b>TOTAL<br/>POINTS</b>", tbl_hdr_style),
        Paragraph("<b>AVG<br/>POINTS</b>", tbl_hdr_style),
        Paragraph("<b>LEVEL</b>", tbl_hdr_style),
    ])
    table_data.append(header_cells)

    # 2. Data Rows
    for s in processed_students:
        row = [
            Paragraph(str(s['s_no']), tbl_cell_center),
            Paragraph(str(s['adm_no']), tbl_cell_center),
            Paragraph(s['name'], tbl_cell_left),
            Paragraph(str(s['ass_no']), tbl_cell_center),
            Paragraph(s['stream'], tbl_cell_center),
            Paragraph(str(s['stream_pos']), tbl_cell_blue_bold if s['stream_pos'] != '-' else tbl_cell_center),
            Paragraph(str(s['overall_pos']), tbl_cell_blue_bold if s['overall_pos'] != '-' else tbl_cell_center),
            Paragraph(str(s['prv_str_pos']), tbl_cell_center),
            Paragraph(str(s['prv_ovr_pos']), tbl_cell_center),
        ]

        # 9 Subject cells
        for code in subjects_list:
            m_info = s['marks'][code]
            if m_info is not None:
                cell_p = Paragraph(f"{m_info['mark']}<br/><font color='#0055CC'><b>{m_info['grade']}</b></font>", tbl_cell_center)
            else:
                cell_p = Paragraph("-", tbl_cell_center)
            row.append(cell_p)

        # Summary cells
        if s['is_assessed']:
            row.extend([
                Paragraph(str(s['sub_entry']), tbl_cell_center),
                Paragraph(f"<b>{s['total_marks']}</b>", tbl_cell_blue_bold),
                Paragraph(f"{s['avg_marks']:.1f}%", tbl_cell_center),
                Paragraph(f"<b>{s['total_points']}</b>", tbl_cell_blue_bold),
                Paragraph(f"{s['avg_points']:.2f}", tbl_cell_center),
                Paragraph(f"<b>{s['level']}</b>", tbl_cell_blue_bold),
            ])
        else:
            row.extend([
                Paragraph("1", tbl_cell_center),
                Paragraph("0", tbl_cell_blue_bold),
                Paragraph("0.0% (P)", tbl_cell_center),
                Paragraph("0", tbl_cell_blue_bold),
                Paragraph("0.00", tbl_cell_center),
                Paragraph("Prov<br/>(BE2)", tbl_cell_blue_bold),
            ])

        table_data.append(row)

    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Styling main table
    ts = [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 1),
        ('RIGHTPADDING', (0, 0), (-1, -1), 1),
    ]

    # Alternating row background
    for r_idx in range(1, len(table_data)):
        if r_idx % 2 == 0:
            ts.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#F1F5F9')))

    main_table.setStyle(TableStyle(ts))
    story.append(main_table)
    story.append(Spacer(1, 8))

    # ==========================================
    # FOOTER SUMMARY BLOCK (Per-Subject & Class Avg)
    # ==========================================
    summary_widths = [
        col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] +
        col_widths[5] + col_widths[6] + col_widths[7] + col_widths[8] # Meta label width ~ 356.5 pt
    ]
    # 9 Subject column widths
    summary_widths.extend([35.0] * len(subjects_list))
    # Rightmost summary width = sum of sub entry..level ~ 155.3 pt
    summary_widths.append(sum(col_widths[18:]))

    summ_lbl_style = ParagraphStyle('SummLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7, alignment=TA_CENTER)
    summ_val_style = ParagraphStyle('SummVal', parent=styles['Normal'], fontName='Helvetica', fontSize=6.5, alignment=TA_CENTER)
    summ_blue_style = ParagraphStyle('SummBlue', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=6.5, alignment=TA_CENTER, textColor=colors.HexColor('#0055CC'))

    # Row 1: Subject headers
    r1 = [Paragraph("<b>SUBJECT</b>", summ_lbl_style)]
    for code in subjects_list:
        r1.append(Paragraph(f"<b>{code}</b>", summ_lbl_style))
    r1.append(Paragraph("<b>CLASS AVG</b>", summ_lbl_style))

    # Row 2: Avg Marks
    r2 = [Paragraph("<b>AVG. MARKS</b>", summ_lbl_style)]
    for code in subjects_list:
        r2.append(Paragraph(f"{subject_stats[code]['avg_marks']:.2f}%", summ_val_style))
    r2.append(Paragraph(f"<b>{overall_class_avg_pct:.1f}%</b>", summ_blue_style))

    # Row 3: Avg Points
    r3 = [Paragraph("<b>AVG. POINTS</b>", summ_lbl_style)]
    for code in subjects_list:
        st = subject_stats[code]
        r3.append(Paragraph(f"{st['avg_points']:.2f} <font color='#0055CC'><b>{st['grade']}</b></font>", summ_val_style))
    r3.append(Paragraph(f"<b>{overall_class_avg_pts:.2f} {overall_class_level}</b>", summ_blue_style))

    summary_table = Table([r1, r2, r3], colWidths=summary_widths)
    summary_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#94A3B8')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))

    # Footnote text
    class_avg_marks_text = Paragraph(
        f"<b>CLASS AVERAGE MARKS: {class_avg_raw_marks:.1f} / {len(subjects_list) * 100}</b>",
        ParagraphStyle('ClassAvgMarks', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, alignment=TA_CENTER, textColor=colors.HexColor('#0F172A'))
    )

    fn1 = Paragraph("- Learner position assigned by Average Points, Total Points & Mean Percentage score (KNEC CBE Standard).", ParagraphStyle('FN1', parent=styles['Normal'], fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#475569')))
    fn2 = Paragraph("- Student performance level calculated using student average marks", ParagraphStyle('FN2', parent=styles['Normal'], fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#475569')))

    footer_block = KeepTogether([
        summary_table,
        Spacer(1, 4),
        class_avg_marks_text,
        Spacer(1, 4),
        fn1,
        fn2
    ])

    story.append(footer_block)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {filename}")

# ==========================================
# 4. SAMPLE RUN WITH DUMMY DATA
# ==========================================

if __name__ == "__main__":
    school_info = {
        'name': "MUCHORWE COMPREHENSIVE SCHOOL",
        'report_title': "STUDENTS' PERFORMANCE MERIT LIST"
    }

    exam_info = {
        'class': 'ALL CLASSES (ALL STREAMS)',
        'term': 'Term 1',
        'year': '2026',
        'exam_name': 'CAT 1 - TERM 1 2026',
        'exam_code': 'ALLCLASSES(ALLSTREAMS)TTERM 12026'
    }

    subjects = ['ENG', 'KIS', 'MAT', 'INT/SC', 'SST', 'CAS', 'C.R.E', 'PRE TECH', 'AGRI']

    # Sample student records (6 complete assessed + 7 provisional 0-mark students)
    students = [
        {
            'adm_no': 'ADM-2024-001', 'name': 'BRIAN AYIECHA', 'stream': 'EAST',
            'marks': {'ENG': 88, 'KIS': 85, 'MAT': 92, 'INT/SC': 84, 'SST': 80, 'CAS': 89, 'C.R.E': 90, 'PRE TECH': 91, 'AGRI': 86}
        },
        {
            'adm_no': 'ADM-2024-002', 'name': 'AMINA MOHAMED', 'stream': 'EAST',
            'marks': {'ENG': 82, 'KIS': 88, 'MAT': 78, 'INT/SC': 75, 'SST': 85, 'CAS': 82, 'C.R.E': 88, 'PRE TECH': 79, 'AGRI': 80}
        },
        {
            'adm_no': 'ADM-2024-006', 'name': 'STACY NJERI', 'stream': 'EAST',
            'marks': {'ENG': 78, 'KIS': 82, 'MAT': 72, 'INT/SC': 76, 'SST': 81, 'CAS': 80, 'C.R.E': 84, 'PRE TECH': 77, 'AGRI': 79}
        },
        {
            'adm_no': 'ADM-2024-003', 'name': 'KEVIN MUTUA', 'stream': 'EAST',
            'marks': {'ENG': 70, 'KIS': 68, 'MAT': 74, 'INT/SC': 72, 'SST': 66, 'CAS': 71, 'C.R.E': 75, 'PRE TECH': 73, 'AGRI': 69}
        },
        {
            'adm_no': 'ADM-2024-004', 'name': 'JOY CHEROP', 'stream': 'EAST',
            'marks': {'ENG': 60, 'KIS': 58, 'MAT': 62, 'INT/SC': 55, 'SST': 64, 'CAS': 63, 'C.R.E': 67, 'PRE TECH': 61, 'AGRI': 59}
        },
        {
            'adm_no': 'ADM-2024-005', 'name': 'EMMANUEL OCHIENG', 'stream': 'EAST',
            'marks': {'ENG': 48, 'KIS': 52, 'MAT': 45, 'INT/SC': 42, 'SST': 50, 'CAS': 51, 'C.R.E': 56, 'PRE TECH': 44, 'AGRI': 47}
        },
        # 7 Provisional Students (0 marks)
        {'adm_no': 'ADM-2024-007', 'name': 'DANIEL KIPCHIRCHIR', 'stream': 'WEST', 'marks': {}},
        {'adm_no': 'ADM-2024-008', 'name': 'MERCY AKINYI', 'stream': 'WEST', 'marks': {}},
        {'adm_no': 'ADM-2024-009', 'name': 'CYNTHIA MBAO', 'stream': 'EAST', 'marks': {}},
        {'adm_no': 'ADM-2024-010', 'name': 'VICTOR KIPTOO', 'stream': 'EAST', 'marks': {}},
        {'adm_no': 'ADM-2025-101', 'name': 'BARAKA KAMAU', 'stream': 'BLUE', 'marks': {}},
        {'adm_no': 'ADM-2025-201', 'name': 'ZAWADI MWANGI', 'stream': 'BLUE', 'marks': {}},
        {'adm_no': 'ADM-2025-501', 'name': 'ETHAN WAMBUA', 'stream': 'BLUE', 'marks': {}},
    ]

    generate_merit_list_pdf('sample_merit_list.pdf', school_info, exam_info, students, subjects)
