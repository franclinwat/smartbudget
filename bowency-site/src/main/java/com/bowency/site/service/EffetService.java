package com.bowency.site.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Effet d'ambiance affiché derrière le contenu (couche canvas), choisi par les
 * administrateurs — indépendant du modèle {@link LayoutService} et du thème
 * {@link ThemeService}. Chaque effet correspond à un script
 * /js/effets/&lt;effet&gt;.js chargé conditionnellement par les templates.
 * Persisté dans un fichier texte, sans base de données.
 */
@Service
public class EffetService {

    public static final String AUCUN = "aucun";
    public static final String FIL = "fil";
    public static final String PROJECTEURS = "projecteurs";
    public static final String TRACES = "traces";
    public static final String HEUREDOREE = "heuredoree";
    private static final Set<String> EFFETS = Set.of(AUCUN, FIL, PROJECTEURS, TRACES, HEUREDOREE);

    private final Path storage;
    private volatile String activeEffet;

    public EffetService(@Value("${bowency.effet.storage:data/active-effet}") String storagePath,
                        @Value("${bowency.effet.default:aucun}") String defaultEffet) {
        this.storage = Path.of(storagePath);
        this.activeEffet = load(defaultEffet);
    }

    public String getActiveEffet() {
        return activeEffet;
    }

    public boolean isValid(String effet) {
        return effet != null && EFFETS.contains(effet);
    }

    public synchronized void setActiveEffet(String effet) {
        if (!isValid(effet)) {
            throw new IllegalArgumentException("Effet inconnu: " + effet);
        }
        this.activeEffet = effet;
        try {
            if (storage.getParent() != null) {
                Files.createDirectories(storage.getParent());
            }
            Files.writeString(storage, effet, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'enregistrer l'effet", e);
        }
    }

    private String load(String fallback) {
        try {
            if (Files.exists(storage)) {
                String saved = Files.readString(storage, StandardCharsets.UTF_8).trim();
                if (EFFETS.contains(saved)) {
                    return saved;
                }
            }
        } catch (IOException ignored) {
            // fichier illisible : on repart sur le défaut
        }
        return EFFETS.contains(fallback) ? fallback : AUCUN;
    }
}
