package com.bowency.site.controller;

import com.bowency.site.service.ContactService;
import com.bowency.site.service.EffetService;
import com.bowency.site.service.LayoutService;
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
    private final ContactService contactService;
    private final LayoutService layoutService;
    private final EffetService effetService;
    private final String adminPassword;

    public AdminController(ThemeService themeService,
                           ContactService contactService,
                           LayoutService layoutService,
                           EffetService effetService,
                           @Value("${bowency.admin.password}") String adminPassword) {
        this.themeService = themeService;
        this.contactService = contactService;
        this.layoutService = layoutService;
        this.effetService = effetService;
        this.adminPassword = adminPassword;
    }

    @GetMapping
    public String panel(HttpSession session, Model model) {
        boolean authenticated = isAuthenticated(session);
        model.addAttribute("authenticated", authenticated);
        model.addAttribute("theme", themeService.getActiveTheme());
        model.addAttribute("layout", layoutService.getActiveLayout());
        model.addAttribute("effet", effetService.getActiveEffet());
        if (authenticated) {
            model.addAttribute("messages", contactService.findAll());
        }
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

    /**
     * Publication de la combinaison composée dans l'aperçu :
     * modèle + effet + thème validés d'un seul geste. C'est la seule
     * combinaison que voient les visiteurs du site public.
     */
    @PostMapping("/publier")
    public String publier(@RequestParam String modele,
                          @RequestParam String effet,
                          @RequestParam String theme,
                          HttpSession session, RedirectAttributes redirect) {
        if (isAuthenticated(session)
                && layoutService.isValid(modele)
                && effetService.isValid(effet)
                && themeService.isValid(theme)) {
            layoutService.setActiveLayout(modele);
            effetService.setActiveEffet(effet);
            themeService.setActiveTheme(theme);
            redirect.addFlashAttribute("published", true);
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
