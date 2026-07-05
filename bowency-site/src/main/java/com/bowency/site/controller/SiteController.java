package com.bowency.site.controller;

import com.bowency.site.service.ContactService;
import com.bowency.site.service.EffetService;
import com.bowency.site.service.LayoutService;
import com.bowency.site.service.ThemeService;

import jakarta.servlet.http.HttpSession;

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
    /** Même clé de session que AdminController : l'aperçu est réservé aux admins. */
    private static final String ADMIN_SESSION_KEY = "BOWENCY_ADMIN";

    private final ThemeService themeService;
    private final ContactService contactService;
    private final LayoutService layoutService;
    private final EffetService effetService;

    public SiteController(ThemeService themeService, ContactService contactService,
                          LayoutService layoutService, EffetService effetService) {
        this.themeService = themeService;
        this.contactService = contactService;
        this.layoutService = layoutService;
        this.effetService = effetService;
    }

    /**
     * Page publique : combinaison validée (modèle + effet + thème).
     * Pour un administrateur connecté, les paramètres d'aperçu permettent de
     * prévisualiser n'importe quelle combinaison SANS la publier (iframe de /admin).
     */
    @GetMapping("/")
    public String index(@RequestParam(required = false) String apercuModele,
                        @RequestParam(required = false) String apercuEffet,
                        @RequestParam(required = false) String apercuTheme,
                        HttpSession session, Model model) {
        String modele = layoutService.getActiveLayout();
        String effet = effetService.getActiveEffet();
        String theme = themeService.getActiveTheme();

        boolean admin = Boolean.TRUE.equals(session.getAttribute(ADMIN_SESSION_KEY));
        if (admin) {
            if (layoutService.isValid(apercuModele)) {
                modele = apercuModele;
            }
            if (effetService.isValid(apercuEffet)) {
                effet = apercuEffet;
            }
            if (themeService.isValid(apercuTheme)) {
                theme = apercuTheme;
            }
        }

        model.addAttribute("theme", theme);
        model.addAttribute("effet", effet);
        return layoutService.templateFor(modele);
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
