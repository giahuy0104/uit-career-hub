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
}
