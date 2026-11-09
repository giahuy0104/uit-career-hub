package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class PiiMaskerTest {
    @Test void masksKnownValuesCaseInsensitively() {
        String result = PiiMasker.mask("Em là nguyễn văn an, anh Trần Bình hướng dẫn.", List.of("Nguyễn Văn An", "Trần Bình"));

        assertThat(result).isEqualTo("Em là [đã ẩn], anh [đã ẩn] hướng dẫn.");
    }

    @Test void masksEmailsPhonesAndStudentCodes() {
        String result = PiiMasker.mask("Liên hệ an.nv@gm.uit.edu.vn, 0912 345 678 hoặc +84987654321. MSSV 25410230.", List.of());

        assertThat(result).doesNotContain("an.nv@", "0912", "987654321", "25410230")
                .contains("[email]", "[số điện thoại]", "[mã số]");
    }

    @Test void keepsOrdinaryNumbersAndHandlesNullInput() {
        assertThat(PiiMasker.mask("Tối ưu API giảm 120ms, xử lý 3000 request/giây.", Arrays.asList(null, "", "A")))
                .isEqualTo("Tối ưu API giảm 120ms, xử lý 3000 request/giây.");
        assertThat(PiiMasker.mask(null, List.of("x"))).isEmpty();
    }

    @Test void knownValuesAreMatchedAsWholeWordsOnly() {
        String result = PiiMasker.mask("Chị Lan review module Planner, Islands và Lan-Anh.", List.of("Lan"));

        assertThat(result).isEqualTo("Chị [đã ẩn] review module Planner, Islands và [đã ẩn]-Anh.");
    }

    @Test void knownValuesAreQuotedNotTreatedAsRegex() {
        assertThat(PiiMasker.mask("Liên hệ C++ Team (Q.1) để hỏi.", List.of("C++ Team (Q.1)")))
                .isEqualTo("Liên hệ [đã ẩn] để hỏi.");
    }

    @Test void masksNamesThatAreNotKnownInAdvance() {
        String result = PiiMasker.mask("Tuần này anh Tuấn review code, chị Ngọc Lan hỗ trợ. Mentor Đức giao task. "
                + "Pair với Nguyễn Hữu Phước và Lê Thị Mai. Gửi Mr. John báo cáo.", List.of());

        assertThat(result).doesNotContain("Tuấn", "Ngọc Lan", "Đức", "Nguyễn Hữu Phước", "Lê Thị Mai", "John")
                .contains("anh [tên người]", "chị [tên người]", "Mentor [tên người]", "Mr. [tên người]");
    }

    @Test void nameHeuristicsLeaveOrdinaryTextAlone() {
        String text = "Em là sinh viên năm 4, làm việc tại TP. Hồ Chí Minh với Spring Boot và React. "
                + "Anh em trong team hỗ trợ không ngừng; bạn nên đọc tài liệu Docker.";

        assertThat(PiiMasker.mask(text, List.of())).isEqualTo(text);
    }

    @Test void decomposedVietnameseIsMatchedLikePrecomposed() {
        String decomposed = java.text.Normalizer.normalize("Chị Nguyễn Thị Hồng gửi tài liệu", java.text.Normalizer.Form.NFD);

        assertThat(PiiMasker.mask(decomposed, List.of())).isEqualTo("Chị [tên người] gửi tài liệu");
        assertThat(PiiMasker.mask(decomposed, List.of("Nguyễn Thị Hồng"))).isEqualTo("Chị [đã ẩn] gửi tài liệu");
    }

    @Test void titleCaseJobDescriptionsStayReadable() {
        String text = "Bạn Sẽ Làm Gì: tham gia Hệ Thống Quản Lý Nhân Sự, Đào Tạo nội bộ, Lưu Trữ Dữ Liệu, Hồ Sơ Năng Lực. "
                + "Chế Độ Lương Thưởng hấp dẫn, Mức Lương cạnh tranh, Lý Thuyết Đồ Thị, Xử Lý Dữ Liệu, Trợ Lý Ảo. "
                + "Làm việc tại Bà Rịa - Vũng Tàu, Phan Thiết hoặc TP. HỒ CHÍ MINH. QUẢN LÝ DỰ ÁN, ĐÀO TẠO, HỒ SƠ. "
                + "Anh Chị Em đồng nghiệp thân thiện; JavaScript, TypeScript, React.";

        assertThat(PiiMasker.mask(text, List.of())).isEqualTo(text);
    }

    @Test void jobTitlesTimesAndLineStartsAreNotNames() {
        String text = "Tech Lead Java; Team Leader Backend; báo cáo cho PM Dự Án; Mentor Frontend hỗ trợ. "
                + "Dùng TS React, họp lúc 3 PM Monday. Tham gia hoạt động Đoàn Thanh Niên.\nCảm ơn anh\nTuần sau em làm API.";

        assertThat(PiiMasker.mask(text, List.of())).isEqualTo(text);
        assertThat(PiiMasker.mask("Lead Hùng review, TS. Bình hướng dẫn", List.of()))
                .isEqualTo("Lead [tên người] review, TS. [tên người] hướng dẫn");
    }

    @Test void masksUpperCaseRolesAndColons() {
        String result = PiiMasker.mask("Họp với chị NGỌC LAN, gửi NGUYỄN VĂN AN. Mentor:Đức; PM Hùng; trưởng phòng Khánh; "
                + "anh Tuấn hỗ trợ; ThS. Hoà hướng dẫn; giám đốc Phúc duyệt.", List.of());

        assertThat(result).doesNotContain("NGỌC LAN", "NGUYỄN", "Đức", "Hùng", "Khánh", "Tuấn", "Hoà", "Phúc")
                .contains("chị [tên người]", "Mentor [tên người]", "PM [tên người]", "anh [tên người]");
    }

    @Test void skippedOrdinaryWordsDoNotHideANameRightAfterThem() {
        assertThat(PiiMasker.mask("Nộp Hồ Sơ Nguyễn Văn An", List.of())).isEqualTo("Nộp Hồ Sơ [tên người]");
        assertThat(PiiMasker.mask("Anh Chị Lan hỗ trợ", List.of())).isEqualTo("Anh Chị [tên người] hỗ trợ");
    }

    @Test void lowerCaseNamesAreAKnownLimit() {
        // Documented limit: without capitals a name cannot be told apart from ordinary words.
        assertThat(PiiMasker.mask("anh tuấn hướng dẫn", List.of())).isEqualTo("anh tuấn hướng dẫn");
    }
}
