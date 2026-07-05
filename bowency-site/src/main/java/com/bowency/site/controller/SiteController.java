package com.bowency.site.controller;

import com.bowency.site.service.ContactService;
import com.bowency.site.service.LayoutService;
import com.bowency.site.service.ThemeService;

import java.util.regex.Pattern;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class SiteController {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final ThemeService themeService;
    private final ContactService contactService;
    private final LayoutService layoutService;

    public SiteController(ThemeService themeService, ContactService contactService, LayoutService layoutService) {
        this.themeService = themeService;
        this.contactService = contactService;
        this.layoutService = layoutService;
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("theme", themeService.getActiveTheme());
        return layoutService.templateFor(layoutService.getActiveLayout());
    }

    @PostMapping("/contact")
    public String contact(@RequestParam(defaultValue = "") String name,
                          @RequestParam(defaultValue = "") String email,
                          @RequestParam(defaultValue = "") String message,
                          @RequestParam(defaultValue = "") String website,
                          RedirectAttributes redirect) {
        // Champ pot de miel : rempli uniquement par les robots — on fait mine d'accepter.
        if (!website.isBlank()) {
            redirect.addFlashAttribute("contactSent", true);
            return "redirect:/#contact";
        }
        name = name.strip();
        email = email.strip();
        message = message.strip();
        if (name.isEmpty() || name.length() > 120
                || email.length() > 200 || !EMAIL.matcher(email).matches()
                || message.isEmpty() || message.length() > 4000) {
            redirect.addFlashAttribute("contactError", true);
            redirect.addFlashAttribute("contactName", name);
            redirect.addFlashAttribute("contactEmail", email);
            redirect.addFlashAttribute("contactMessage", message);
        } else {
            contactService.save(name, email, message);
            redirect.addFlashAttribute("contactSent", true);
        }
        return "redirect:/#contact";
    }
}
