package com.bowency.site.controller;

import com.bowency.site.service.ThemeService;

import jakarta.servlet.http.HttpSession;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/admin")
public class AdminController {

    private static final String SESSION_KEY = "BOWENCY_ADMIN";

    private final ThemeService themeService;
    private final String adminPassword;

    public AdminController(ThemeService themeService,
                           @Value("${bowency.admin.password}") String adminPassword) {
        this.themeService = themeService;
        this.adminPassword = adminPassword;
    }

    @GetMapping
    public String panel(HttpSession session, Model model) {
        model.addAttribute("authenticated", isAuthenticated(session));
        model.addAttribute("theme", themeService.getActiveTheme());
        return "admin";
    }

    @PostMapping("/login")
    public String login(@RequestParam String password, HttpSession session, RedirectAttributes redirect) {
        if (constantTimeEquals(password, adminPassword)) {
            session.setAttribute(SESSION_KEY, Boolean.TRUE);
        } else {
            redirect.addFlashAttribute("error", true);
        }
        return "redirect:/admin";
    }

    @PostMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/admin";
    }

    @PostMapping("/theme")
    public String changeTheme(@RequestParam String theme, HttpSession session, RedirectAttributes redirect) {
        if (isAuthenticated(session) && themeService.isValid(theme)) {
            themeService.setActiveTheme(theme);
            redirect.addFlashAttribute("saved", true);
        }
        return "redirect:/admin";
    }

    private boolean isAuthenticated(HttpSession session) {
        return Boolean.TRUE.equals(session.getAttribute(SESSION_KEY));
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
