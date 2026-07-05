package com.bowency.site.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Version d'affichage du site (mise en page), choisie par les administrateurs —
 * indépendante du thème de couleurs {@link ThemeService}.
 * Chaque version partage le même contenu (bundles i18n) mais un template distinct :
 *   immersif → index · minimal → index-minimal · bento → index-bento
 * Persistée dans un fichier texte pour survivre aux redémarrages, sans base de données.
 */
@Service
public class LayoutService {

    public static final String IMMERSIF = "immersif";
    public static final String MINIMAL = "minimal";
    public static final String BENTO = "bento";
    private static final Set<String> LAYOUTS = Set.of(IMMERSIF, MINIMAL, BENTO);

    /** Template Thymeleaf servi pour chaque version. */
    public String templateFor(String layout) {
        if (MINIMAL.equals(layout)) {
            return "index-minimal";
        }
        if (BENTO.equals(layout)) {
            return "index-bento";
        }
        return "index";
    }

    private final Path storage;
    private volatile String activeLayout;

    public LayoutService(@Value("${bowency.layout.storage:data/active-layout}") String storagePath,
                         @Value("${bowency.layout.default:immersif}") String defaultLayout) {
        this.storage = Path.of(storagePath);
        this.activeLayout = load(defaultLayout);
    }

    public String getActiveLayout() {
        return activeLayout;
    }

    public boolean isValid(String layout) {
        return layout != null && LAYOUTS.contains(layout);
    }

    public synchronized void setActiveLayout(String layout) {
        if (!isValid(layout)) {
            throw new IllegalArgumentException("Version d'affichage inconnue: " + layout);
        }
        this.activeLayout = layout;
        try {
            if (storage.getParent() != null) {
                Files.createDirectories(storage.getParent());
            }
            Files.writeString(storage, layout, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'enregistrer la version d'affichage", e);
        }
    }

    private String load(String fallback) {
        try {
            if (Files.exists(storage)) {
                String saved = Files.readString(storage, StandardCharsets.UTF_8).trim();
                if (LAYOUTS.contains(saved)) {
                    return saved;
                }
            }
        } catch (IOException ignored) {
            // fichier illisible : on repart sur le défaut
        }
        return LAYOUTS.contains(fallback) ? fallback : IMMERSIF;
    }
}
