package vn.edu.uit.careerhub.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RootController {
    @GetMapping("/api")
    Map<String, String> root() {
        return Map.of("name", "UIT Career Hub API", "version", "0.18.0-java");
    }
}
