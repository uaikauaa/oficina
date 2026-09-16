package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProdutoMaquinaRepository extends JpaRepository<ProdutoMaquina, Long> {

    @Query("SELECT pm FROM ProdutoMaquina pm JOIN FETCH pm.maquina m WHERE pm.produto.id = :produtoId")
    List<ProdutoMaquina> findByProdutoIdComMaquina(@Param("produtoId") Long produtoId);

    List<ProdutoMaquina> findByMaquinaId(Long maquinaId);

    boolean existsByProdutoIdAndMaquinaId(Long produtoId, Long maquinaId);

    Optional<ProdutoMaquina> findByProdutoIdAndMaquinaId(Long produtoId, Long maquinaId);

    void deleteByProdutoIdAndMaquinaId(Long produtoId, Long maquinaId);
}
