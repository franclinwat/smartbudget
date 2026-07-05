package com.bowency.site.controller;

import com.bowency.site.service.ThemeService;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SiteController {

    private final ThemeService themeService;

    public SiteController(ThemeService themeService) {
        this.themeService = themeService;
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("theme", themeService.getActiveTheme());
        return "index";
    }
}
